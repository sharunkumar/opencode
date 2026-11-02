export * as CustomRetitlePlugin from "./retitle.js"

import { define } from "@opencode/plugin/effect/plugin"
import { Session } from "@opencode/schema/session"
import { Clock, Effect, Schema, Stream } from "effect"

const MAX_TITLE = 100
/** Session metadata key that marks a session as titled by hand. Compaction keeps metadata, and forks inherit it. */
export const METADATA_KEY = "custom.retitle"
// Upstream's auto-title publishes its rename some time after the `title` hook fires, or not at all if it gives up.
const AUTO_TITLE_WINDOW = 2 * 60 * 1000

const Mark = Schema.Struct({ manual: Schema.Literal(true) })
const isManual = (session: Session.Info) => Schema.is(Mark)(session.metadata?.[METADATA_KEY])

export const Plugin = define({
  id: "custom.session.retitle",
  effect: Effect.fn("CustomRetitlePlugin")(function* (ctx) {
    // Renames this plugin is about to make, keyed by session and title.
    const own = new Set<string>()
    // Sessions with an upstream auto-title in flight, and when that window closes.
    const autoTitle = new Map<Session.ID, number>()
    const renameKey = (sessionID: Session.ID, title: string) => `${sessionID}\n${title}`

    yield* ctx.session.hook("title", (event) =>
      Clock.currentTimeMillis.pipe(Effect.map((now) => void autoTitle.set(event.sessionID, now + AUTO_TITLE_WINDOW))),
    )

    // Any rename that is neither ours nor upstream's auto-title is manual: the TUI, the app, the API, or the
    // model's session_rename tool. A rename made while an auto-title is in flight counts as the auto-title.
    yield* ctx.event.subscribe({ types: ["session.renamed"] }).pipe(
      Stream.runForEach((event) =>
        Effect.gen(function* () {
          const sessionID = event.data.sessionID
          if (own.delete(renameKey(sessionID, event.data.title))) return
          const closes = autoTitle.get(sessionID)
          autoTitle.delete(sessionID)
          if (closes !== undefined && closes >= (yield* Clock.currentTimeMillis)) return
          const session = yield* ctx.session.get({ sessionID })
          if (isManual(session)) return
          // Not atomic: metadata writes replace the whole map, so a concurrent writer between get and update loses.
          yield* ctx.session.update({
            sessionID,
            metadata: { ...session.metadata, [METADATA_KEY]: { manual: true } },
          })
        }).pipe(Effect.catchCause(() => Effect.void)),
      ),
      Effect.forkScoped({ startImmediately: true }),
    )

    yield* ctx.event.subscribe({ types: ["session.compaction.ended"] }).pipe(
      Stream.runForEach((event) => {
        const sessionID = event.data.sessionID
        return Effect.gen(function* () {
          const session = yield* ctx.session.get({ sessionID })
          if (session.parentID || isManual(session)) return
          const result = yield* ctx.session.generate({
            sessionID,
            prompt: [
              "Write a concise title (at most 8 words, no quotes, no trailing punctuation) for this conversation.",
              "Reply with the title only.",
              "",
              event.data.text,
            ].join("\n"),
          })
          const title = result.text.trim().split("\n")[0]?.trim().slice(0, MAX_TITLE)
          if (!title) return
          own.add(renameKey(sessionID, title))
          yield* ctx.session.update({ sessionID, title })
        }).pipe(Effect.catchCause(() => Effect.void))
      }),
      Effect.forkScoped({ startImmediately: true }),
    )
  }),
})
