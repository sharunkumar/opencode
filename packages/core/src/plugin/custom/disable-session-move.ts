export * as CustomDisableSessionMovePlugin from "./disable-session-move.js"

import { define } from "@opencode/plugin/effect/plugin"
import { Effect } from "effect"

// Registered after the builtin opencode tools, so the removal wins.
export const tool = "opencode_session_move"

export const Plugin = define({
  id: "custom.tool.session-move.disable",
  effect: (ctx) => ctx.tool.transform((editor) => editor.remove(tool)).pipe(Effect.asVoid),
})
