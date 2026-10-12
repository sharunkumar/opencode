export * as CustomRetitlePlugin from "./retitle.js"

import { define } from "@opencode/plugin/effect/plugin"
import { Effect, Stream } from "effect"

const MAX_TITLE = 100

export const Plugin = define({
  id: "custom.session.retitle",
  effect: Effect.fn("CustomRetitlePlugin")(function* (ctx) {
    yield* ctx.event.subscribe().pipe(
      Stream.runForEach((event) => {
        if (event.type !== "session.compaction.ended") return Effect.void
        const sessionID = event.data.sessionID
        return Effect.gen(function* () {
          const session = yield* ctx.session.get({ sessionID })
          if (session.parentID) return
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
          yield* ctx.session.update({ sessionID, title })
        }).pipe(Effect.catchCause(() => Effect.void))
      }),
      Effect.forkScoped,
    )
  }),
})
