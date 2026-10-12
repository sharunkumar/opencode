export * as CustomTimeoutsPlugin from "./timeouts.js"

import { define } from "@opencode/plugin/effect/plugin"
import { CustomTimeouts } from "@opencode/schema/custom-timeouts"
import { Effect, Predicate } from "effect"

const key = (sessionID: string) => `custom.timeouts.${sessionID}`

// Foreground shell commands have no default timeout unless the session opted in with /timeouts.
// An explicit `timeout` on the call always applies.
export const Plugin = define({
  id: "custom.shell.timeouts",
  effect: Effect.fn("CustomTimeoutsPlugin")(function* (ctx) {
    const enabled = (sessionID: string) => ctx.storage.get(key(sessionID)).pipe(Effect.map((value) => value === true))

    yield* ctx.rpc
      .register(CustomTimeouts.Contract, {
        get: (input) => enabled(input.sessionID).pipe(Effect.map((enabled) => ({ enabled }))),
        toggle: (input) =>
          Effect.gen(function* () {
            const next = !(yield* enabled(input.sessionID))
            yield* ctx.storage.set(key(input.sessionID), next)
            return { enabled: next }
          }),
      })
      .pipe(Effect.orDie)

    yield* ctx.tool.hook("execute.before", (event) =>
      Effect.gen(function* () {
        if (event.tool !== "shell" || !Predicate.isObject(event.input)) return
        if (event.input.timeout !== undefined || event.input.background === true) return
        if (yield* enabled(event.sessionID)) return
        event.input = { ...event.input, timeout: 0 }
      }),
    )
  }),
})
