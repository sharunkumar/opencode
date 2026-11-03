/** @jsxImportSource @opentui/solid */
import { DiffRenderable, LineNumberRenderable, TextareaRenderable, type Renderable } from "@opentui/core"
import { testRender, type JSX } from "@opentui/solid"
import { expect, test } from "bun:test"
import { createLineComment } from "../../src/component/line-comment"
import { createLineSelection } from "../../src/component/line-selection"
import { PatchDiff } from "../../src/component/patch-diff"
import { ConfigProvider } from "../../src/config"
import { Keymap } from "../../src/context/keymap"
import { ThemeProvider, useTheme, useThemes } from "../../src/context/theme"
import { ToastProvider } from "../../src/ui/toast"
import { emptyThemeSource, tmpdir } from "../fixture/fixture"
import { TestTuiContexts } from "../fixture/tui-environment"
import { createTuiResolvedConfig } from "../fixture/tui-runtime"
import type { PatchLine } from "../../src/util/diff"

const patch = `--- a/src/file.txt
+++ b/src/file.txt
@@ -1,4 +1,4 @@
 const first = true
-const oldFirst = true
+const newFirst = true
 const afterFirst = true
 const last = true
@@ -20,2 +20,2 @@
 const second = true
-const oldSecond = true
+const newSecond = true`

test("dragging unified line numbers floats a comment box right below the last picked line and sends the comment", async () => {
  await using setup = await renderComment({ view: "unified", width: 80 })
  const app = setup.app
  const side = diffSides(app.renderer.root)[0]!
  const removed = rowOf(app, "const oldFirst")
  const lastPicked = rowOf(app, "const afterFirst")
  const original = background(app, removed)

  await app.mockMouse.click(side.x + side.width - 2, removed)
  await app.flush()
  expect(app.captureCharFrame()).not.toContain("Leave a comment")
  app.renderer.clearSelection()

  await app.mockMouse.drag(side.x + 1, removed, side.x + 1, lastPicked)
  await app.waitForFrame(
    (frame) =>
      rowOf(app, "Leave a comment") === lastPicked + 1 &&
      app.renderer.currentFocusedRenderable instanceof TextareaRenderable,
  )
  // The box covers the lines below the pick instead of pushing them down.
  expect(rowOf(app, "L2-L3 · enter send · esc cancel")).toBe(lastPicked + 2)
  expect(app.captureCharFrame()).not.toContain("const last")
  expect(rowOf(app, "const newSecond")).toBe(lastPicked + 5)
  expect(background(app, removed)).not.toBe(original)
  expect(background(app, removed + 1)).toBe(background(app, removed))
  expect(background(app, removed + 2)).toBe(background(app, removed))
  expect(background(app, removed - 1)).not.toBe(background(app, removed))
  expect([-1, 0, 1, 2].map((offset) => marker(app, side, removed + offset))).toEqual([" ", "+", "▌", "▌"])

  app.mockInput.typeText("Rename it")
  app.mockInput.pressEnter()
  await app.waitForFrame(() => setup.sent.length === 1 && background(app, removed) === original)
  expect(app.captureCharFrame()).not.toContain("Leave a comment")
  expect(rowOf(app, "const last")).toBe(lastPicked + 1)
  expect(marker(app, side, removed)).toBe(" ")
  expect(setup.sent).toEqual([
    [
      "src/file.txt L2-L3",
      "",
      "```diff",
      "-const oldFirst = true",
      "+const newFirst = true",
      " const afterFirst = true",
      "```",
      "",
      "Rename it",
    ].join("\n"),
  ])
})

test("hovering a line shows a plus in its gutter, and the bar follows a drag up and down", async () => {
  await using setup = await renderComment({ view: "unified", width: 80 })
  const app = setup.app
  const side = diffSides(app.renderer.root)[0]!
  const first = rowOf(app, "const first")
  const last = rowOf(app, "const last")

  await app.mockMouse.moveTo(side.x + side.width - 4, first + 1)
  await app.waitForFrame(() => marker(app, side, first + 1) === "+")
  expect(marker(app, side, first)).toBe(" ")
  await app.mockMouse.moveTo(side.x + side.width - 4, 23)
  await app.waitForFrame(() => marker(app, side, first + 1) === " ")

  await app.mockMouse.pressDown(side.x + 1, last)
  await app.mockMouse.emitMouseEvent("drag", side.x + 1, first + 1)
  await app.waitForFrame(() => marker(app, side, first + 1) === "+")
  expect([first, first + 1, first + 2, first + 3, last].map((row) => marker(app, side, row))).toEqual([
    " ",
    "+",
    "▌",
    "▌",
    "▌",
  ])
  await app.mockMouse.emitMouseEvent("drag", side.x + 1, last - 1)
  await app.waitForFrame(() => marker(app, side, first + 1) === " ")
  expect([last - 1, last].map((row) => marker(app, side, row))).toEqual(["+", "▌"])
  await app.mockMouse.release(side.x + 1, last - 1)
  await app.waitForFrame((frame) => frame.includes("L3-L4 · enter send"))
  expect([last - 1, last].map((row) => marker(app, side, row))).toEqual(["+", "▌"])
  app.mockInput.pressEscape()
  await app.waitForFrame((frame) => marker(app, side, last - 1) === " " && !frame.includes("Leave a comment"))
  expect(setup.sent).toHaveLength(0)
})

test("the comment box closes without sending when it loses focus", async () => {
  await using setup = await renderComment({ view: "unified", width: 80 })
  const app = setup.app
  const side = diffSides(app.renderer.root)[0]!
  const removed = rowOf(app, "const oldFirst")
  const original = background(app, removed)

  await app.mockMouse.drag(side.x + 1, removed, side.x + 1, removed)
  await app.waitForFrame(() => app.renderer.currentFocusedRenderable instanceof TextareaRenderable)
  app.mockInput.typeText("Half")
  app.renderer.currentFocusedRenderable?.blur()
  await app.waitForFrame(
    (frame) =>
      !frame.includes("enter send") && background(app, removed) === original && marker(app, side, removed) === " ",
  )
  expect(setup.sent).toHaveLength(0)
})

test("split line numbers comment on one side and cancelling sends nothing", async () => {
  await using setup = await renderComment({ view: "split", width: 160 })
  const app = setup.app
  const [left, right] = diffSides(app.renderer.root)
  const row = rowOf(app, "const newFirst")

  await app.mockMouse.click(left!.x + 1, row)
  await app.waitForFrame((frame) => frame.includes("L2 (removed) · enter send"))
  app.mockInput.pressEscape()
  await app.waitForFrame((frame) => !frame.includes("Leave a comment"))

  await app.mockMouse.drag(right!.x + 1, row, right!.x + 1, row + 1)
  await app.waitForFrame(
    (frame) =>
      frame.includes("L2-L3 · enter send") && app.renderer.currentFocusedRenderable instanceof TextareaRenderable,
  )
  app.mockInput.typeText("Why?")
  app.mockInput.pressEnter()
  await app.waitForFrame(() => setup.sent.length === 1)
  expect(setup.sent).toEqual([
    ["src/file.txt L2-L3", "", "```diff", "+const newFirst = true", " const afterFirst = true", "```", "", "Why?"].join(
      "\n",
    ),
  ])
})

test("line numbers do not pick lines without a comment handler", async () => {
  await using setup = await renderComment({ view: "unified", width: 80, comment: false })
  const app = setup.app
  const side = diffSides(app.renderer.root)[0]!
  const removed = rowOf(app, "const oldFirst")
  const original = background(app, removed)
  await app.mockMouse.pressDown(side.x + 1, removed)
  await app.flush()
  expect(background(app, removed)).toBe(original)
  await app.mockMouse.release(side.x + 1, removed)
  await app.flush()
  expect(app.captureCharFrame()).not.toContain("Leave a comment")
})

test("numbered code without a diff comments on its lines as added lines", async () => {
  const sent: string[] = []
  const lines: PatchLine[] = ["one", "two", "three"].map((text, index) => ({ kind: "add", text, newLine: index + 1 }))
  function Written() {
    const theme = useTheme()
    const comment = createLineComment(async (text) => {
      sent.push(text)
    })
    const selection = createLineSelection({
      select: () => (picked, anchor) => comment.open("write", "notes.txt", picked, anchor),
      color: () => theme.diff.background.selected,
      marker: () => theme.diff.highlight.selected,
      source: (target) =>
        target instanceof LineNumberRenderable ? { sides: [target], lineAt: (_, row) => lines[row] } : undefined,
    })
    return (
      <box>
        <line_number fg={theme.text.muted} minWidth={3} paddingRight={1} {...selection}>
          <code
            fg={theme.text.base}
            syntaxStyle={useThemes().currentSyntax()}
            content={lines.map((line) => line.text).join("\n")}
          />
        </line_number>
        <comment.Box at="write" />
      </box>
    )
  }
  await using setup = await renderTui(() => <Written />, { width: 80 })
  const app = setup.app
  await app.waitForFrame((frame) => frame.includes("three"))
  const original = background(app, rowOf(app, "two"))
  const three = rowOf(app, "three")
  await app.mockMouse.drag(0, rowOf(app, "two"), 0, three)
  await app.waitForFrame(
    () =>
      rowOf(app, "Leave a comment") === three + 1 &&
      app.renderer.currentFocusedRenderable instanceof TextareaRenderable,
  )
  expect(rowOf(app, "L2-L3 · enter send")).toBe(three + 2)
  expect(background(app, rowOf(app, "two"))).not.toBe(original)
  expect(marker(app, lineNumbers(app.renderer.root)[0]!, rowOf(app, "three"))).toBe("▌")
  app.mockInput.typeText("Trim")
  app.mockInput.pressEnter()
  await app.waitForFrame(() => sent.length === 1)
  expect(sent).toEqual(["notes.txt L2-L3\n\n```diff\n+two\n+three\n```\n\nTrim"])
})

async function renderComment(options: { view: "unified" | "split"; width: number; comment?: boolean }) {
  const sent: string[] = []
  function Diff() {
    const theme = useTheme()
    const comment = createLineComment(async (text) => {
      sent.push(text)
    })
    return (
      <box>
        <PatchDiff
          diff={patch}
          hunkFg={theme.diff.text.hunkHeader}
          view={options.view}
          showLineNumbers={true}
          width="100%"
          fg={theme.text.base}
          addedBg={theme.diff.background.added}
          removedBg={theme.diff.background.removed}
          contextBg={theme.diff.background.context}
          lineNumberFg={theme.diff.lineNumber.text}
          lineNumberBg={theme.diff.background.context}
          addedLineNumberBg={theme.diff.lineNumber.background.added}
          removedLineNumberBg={theme.diff.lineNumber.background.removed}
          selectedBg={theme.diff.background.selected}
          selectedMarker={theme.diff.highlight.selected}
          onSelectLines={
            options.comment === false
              ? undefined
              : (lines, anchor) => comment.open("diff", "src/file.txt", lines, anchor)
          }
        />
        <comment.Box at="diff" />
      </box>
    )
  }
  const setup = await renderTui(() => <Diff />, { width: options.width })
  await setup.app.waitForFrame((frame) => frame.includes("const newFirst"))
  return { ...setup, sent }
}

async function renderTui(render: () => JSX.Element, options: { width: number }) {
  const temporary = await tmpdir()
  const app = await testRender(
    () => (
      <TestTuiContexts directory={temporary.path} paths={{ state: temporary.path }}>
        <ConfigProvider config={createTuiResolvedConfig()}>
          <ThemeProvider mode="dark" source={emptyThemeSource}>
            <Keymap.Provider>
              <ToastProvider>{render()}</ToastProvider>
            </Keymap.Provider>
          </ThemeProvider>
        </ConfigProvider>
      </TestTuiContexts>
    ),
    { width: options.width, height: 24, kittyKeyboard: true },
  )
  app.renderer.start()
  return {
    app,
    async [Symbol.asyncDispose]() {
      app.renderer.destroy()
      await temporary[Symbol.asyncDispose]()
    },
  }
}

function diffSides(root: Renderable): LineNumberRenderable[] {
  if (root instanceof DiffRenderable)
    return root.getChildren().filter((child): child is LineNumberRenderable => child instanceof LineNumberRenderable)
  return root.getChildren().flatMap(diffSides)
}

function lineNumbers(root: Renderable): LineNumberRenderable[] {
  if (root instanceof LineNumberRenderable) return [root]
  return root.getChildren().flatMap(lineNumbers)
}

function rowOf(app: Awaited<ReturnType<typeof testRender>>, text: string) {
  return app
    .captureCharFrame()
    .split("\n")
    .findIndex((line) => line.includes(text))
}

/** The character in the gutter's first column, where the selection bar and its `+` draw. */
function marker(app: Awaited<ReturnType<typeof testRender>>, side: LineNumberRenderable, row: number) {
  return app.captureCharFrame().split("\n")[row]?.[side.x] ?? ""
}

/** The background of the row's line-number gutter. */
function background(app: Awaited<ReturnType<typeof testRender>>, row: number) {
  return `${app.captureSpans().lines[row]?.spans[0]?.bg}`
}
