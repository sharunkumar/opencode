export * as CustomTaskResumePlugin from "./task-resume.js"

import { define } from "@opencode/plugin/effect/plugin"
import { Session } from "@opencode/schema/session"
import { Effect, Predicate, Schema } from "effect"

const isSessionID = Schema.is(Session.ID)

export const Plugin = define({
  id: "custom.tool.subagent.resume",
  effect: (ctx) =>
    ctx.tool
      .hook("execute.before", (event) =>
        Effect.gen(function* () {
          if (event.tool !== "subagent" || !Predicate.isObject(event.input)) return
          const sessionID = event.input.sessionID
          if (sessionID === undefined) return
          const child = isSessionID(sessionID)
            ? yield* ctx.session.get({ sessionID }).pipe(Effect.catch(() => Effect.succeed(undefined)))
            : undefined
          if (child?.parentID === event.sessionID) return
          const input = { ...event.input }
          delete input.sessionID
          event.input = input
        }),
      )
      .pipe(Effect.asVoid),
})
