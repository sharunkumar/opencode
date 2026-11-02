import { TextareaRenderable, type BoxRenderable, type MouseEvent } from "@opentui/core"
import { useRenderer } from "@opentui/solid"
import { createSignal, onCleanup, onMount, Show } from "solid-js"
import { useCursorStyle } from "../config"
import { Keymap } from "../context/keymap"
import { useTheme } from "../context/theme"
import { EmptyBorder } from "../ui/border"
import { useToast } from "../ui/toast"
import type { PatchLine } from "../util/diff"
import type { LineAnchor } from "./line-selection"

type Pending = {
  readonly at: string
  readonly file: string
  readonly lines: readonly PatchLine[]
  readonly anchor: LineAnchor
  readonly close: () => void
}

/**
 * A box for commenting on lines picked in a diff. `open` shows it floating over the code just below the picked lines,
 * from a `Box` with the same `at` placed inside a container of the diff, and settles once the comment is sent or
 * dismissed, so the picked lines can stay marked until then. Sent comments go through `send`; prompts steer by default,
 * so a comment made while the session works is queued for its next step.
 */
export function createLineComment(send: (text: string) => Promise<unknown>) {
  const toast = useToast()
  const [pending, setPending] = createSignal<Pending>()

  const open = (at: string, file: string, lines: readonly PatchLine[], anchor: LineAnchor) =>
    new Promise<void>((resolve) => {
      pending()?.close()
      const entry: Pending = {
        at,
        file,
        lines,
        anchor,
        close() {
          if (pending() === entry) setPending(undefined)
          resolve()
        },
      }
      setPending(entry)
    })

  const submit = (entry: Pending, comment: string) => {
    entry.close()
    if (!comment.trim()) return
    void send(lineCommentPrompt(entry.file, entry.lines, comment))
      .then(() => toast.show({ message: "Comment sent", variant: "success" }))
      .catch(toast.error)
  }

  function Box(props: { at: string }) {
    return (
      <Show when={pending()?.at === props.at ? pending() : undefined} keyed>
        {(entry) => (
          <LineCommentBox
            anchor={entry.anchor}
            range={lineRange(entry.lines)}
            onSubmit={(comment) => submit(entry, comment)}
            onCancel={entry.close}
          />
        )}
      </Show>
    )
  }

  return { open, Box }
}

function LineCommentBox(props: {
  anchor: LineAnchor
  range: string
  onSubmit: (comment: string) => void
  onCancel: () => void
}) {
  const theme = useTheme()
  const renderer = useRenderer()
  const cursorStyle = useCursorStyle()
  const [textarea, setTextarea] = createSignal<TextareaRenderable>()
  const previous = renderer.currentFocusedRenderable

  Keymap.createLayer(() => ({
    target: textarea,
    enabled: textarea() !== undefined,
    // Above the composer's layers, whose Enter and Escape would otherwise submit the prompt or interrupt the session.
    priority: 2,
    commands: [
      {
        bind: "return",
        title: "Send comment",
        group: "Comment",
        run: () => props.onSubmit(textarea()?.plainText ?? ""),
      },
      { bind: "escape", title: "Cancel comment", group: "Comment", run: props.onCancel },
    ],
  }))

  onMount(() => textarea()?.focus())
  onCleanup(() => {
    if (previous && !previous.isDestroyed) previous.focus()
  })

  // The box floats inside a transcript row, whose clicks open message actions.
  const keep = (event: MouseEvent) => event.stopPropagation()

  // Layout moves the anchor's renderable (scrolling, wrapping, rebuilt diffs), so follow it every frame.
  const follow = (element: BoxRenderable) => {
    element.onLifecyclePass = () => {
      if (props.anchor.target.isDestroyed) return
      element.translateY = props.anchor.target.y + props.anchor.offset - (element.y - element.translateY)
    }
    renderer.registerLifecyclePass(element)
    onCleanup(() => renderer.unregisterLifecyclePass(element))
  }

  return (
    <box
      ref={follow}
      position="absolute"
      top={0}
      left={0}
      right={0}
      zIndex={10}
      border={["left"]}
      borderColor={theme.diff.highlight.selected}
      customBorderChars={{ ...EmptyBorder, vertical: "▌" }}
      paddingLeft={1}
      backgroundColor={theme.background.raised.high}
      onMouseDown={keep}
      onMouseUp={keep}
    >
      <textarea
        ref={setTextarea}
        minHeight={1}
        maxHeight={6}
        wrapMode="word"
        placeholder="Leave a comment"
        placeholderColor={theme.text.muted}
        textColor={theme.text.formfield.base}
        focusedTextColor={theme.text.formfield.base}
        cursorColor={theme.text.base}
        cursorStyle={cursorStyle()}
      />
      <text fg={theme.text.muted} wrapMode="none" truncate>
        {`${props.range} · enter send · esc cancel`}
      </text>
    </box>
  )
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
    `${file} ${lineRange(lines)}`,
    "",
    `${fence}diff`,
    ...lines.map((line) => sign[line.kind] + line.text),
    fence,
    "",
    comment.trim(),
  ].join("\n")
}
