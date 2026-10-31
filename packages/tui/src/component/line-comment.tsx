import { useDialog } from "../ui/dialog"
import { DialogPrompt } from "../ui/dialog-prompt"
import { useToast } from "../ui/toast"
import type { PatchLine } from "../util/diff"

/**
 * Returns a function that asks for a comment on lines picked in a diff and sends it with `send`. Prompts steer by
 * default, so a comment made while the session works is queued for its next step.
 */
export function useLineComment() {
  const dialog = useDialog()
  const toast = useToast()
  return (input: { file: string; lines: readonly PatchLine[]; send: (text: string) => Promise<unknown> }) =>
    new Promise<string | undefined>((resolve) =>
      dialog.replace(
        () => (
          <DialogPrompt
            title="Comment"
            description={() => <text>{`${input.file} ${lineRange(input.lines)}`}</text>}
            placeholder="Leave a comment"
            onConfirm={(value) => {
              resolve(value)
              dialog.clear()
            }}
          />
        ),
        () => resolve(undefined),
      ),
    )
      .then(async (comment) => {
        if (!comment?.trim()) return
        await input.send(lineCommentPrompt(input.file, input.lines, comment))
        toast.show({ message: "Comment sent", variant: "success" })
      })
      .catch(toast.error)
}

/** Names the picked lines by their new line numbers, or by their old ones when only removed lines are picked. */
function lineRange(lines: readonly PatchLine[]) {
  const added = lines.flatMap((line) => (line.newLine === undefined ? [] : [line.newLine]))
  const numbers = added.length > 0 ? added : lines.flatMap((line) => (line.oldLine === undefined ? [] : [line.oldLine]))
  const first = Math.min(...numbers)
  const last = Math.max(...numbers)
  const range = first === last ? `L${first}` : `L${first}-L${last}`
  return added.length > 0 ? range : `${range} (removed)`
}

function lineCommentPrompt(file: string, lines: readonly PatchLine[], comment: string) {
  const ticks = Math.max(0, ...lines.flatMap((line) => line.text.match(/`+/g) ?? []).map((run) => run.length))
  const fence = "`".repeat(Math.max(3, ticks + 1))
  const sign = { add: "+", remove: "-", context: " " } as const
  return [
    `Review comment on ${file} ${lineRange(lines)}:`,
    "",
    `${fence}diff`,
    ...lines.map((line) => sign[line.kind] + line.text),
    fence,
    "",
    comment.trim(),
  ].join("\n")
}
