export * as CustomCancelHintsPlugin from "./cancel-hints.js"

import { define } from "@opencode/plugin/effect/plugin"
import { Effect } from "effect"
import { ShellTool } from "../../tool/plugin/shell.js"

// Upstream's shell description sentence that the hint replaces. If upstream rewords it, the replace is a no-op and
// the plugin test fails.
export const backgroundSentence = "Background commands return immediately, and you will be notified when they complete."
export const cancelSentence =
  "Background commands return immediately with a shell ID. Cancel one with the cancel tool. You will be notified when it completes."
const backgroundPrefix = "Command moved to the background"

export const cancelHint = (shellID: string) => `Cancel it with the cancel tool, passing id ${shellID}.`

// Registered after the builtin tools, so the shell tool exists when the transform runs.
export const Plugin = define({
  id: "custom.tool.cancel-hints",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.tool.transform((editor) =>
      editor.update(ShellTool.name, (tool) => {
        tool.description = tool.description.replace(backgroundSentence, cancelSentence)
      }),
    )
    yield* ctx.tool.hook("execute.after", (event) =>
      Effect.sync(() => {
        if (event.tool !== ShellTool.name || event.status !== "completed") return
        const shellID = event.result.metadata?.shellID
        const content = event.result.content
        if (event.result.metadata?.status !== "running" || typeof shellID !== "string" || !Array.isArray(content))
          return
        event.result = {
          ...event.result,
          content: content.map((item) =>
            item.type === "text" && item.text.startsWith(backgroundPrefix)
              ? { ...item, text: `${item.text}\n${cancelHint(shellID)}` }
              : item,
          ),
        }
      }),
    )
  }),
})
