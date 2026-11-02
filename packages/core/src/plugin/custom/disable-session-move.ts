export * as CustomDisableSessionMovePlugin from "./disable-session-move.js"

import { define } from "@opencode/plugin/effect/plugin"
import { Effect } from "effect"

// Registered after the builtin opencode tools, so the removal wins.
export const tool = "opencode_session_move"

export const Plugin = define({
  id: "custom.tool.session-move.disable",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.tool.transform((editor) => editor.remove(tool))
    // The builtin opencode tools add a system hint that points at the removed tool. Its hook runs first.
    yield* ctx.session.hook("context", (event) =>
      Effect.sync(() => {
        const kept = event.system.filter((part) => !part.text.includes("tools.opencode.session_move"))
        event.system.splice(0, event.system.length, ...kept)
      }),
    )
  }),
})
