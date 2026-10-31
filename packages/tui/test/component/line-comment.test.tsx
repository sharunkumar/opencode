/** @jsxImportSource @opentui/solid */
import { DiffRenderable, LineNumberRenderable, TextareaRenderable, type Renderable } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { useLineComment } from "../../src/component/line-comment"
import { createLineSelection } from "../../src/component/line-selection"
import { PatchDiff } from "../../src/component/patch-diff"
import { ConfigProvider } from "../../src/config"
import { Keymap } from "../../src/context/keymap"
import { ThemeProvider, useTheme, useThemes } from "../../src/context/theme"
import { DialogProvider } from "../../src/ui/dialog"
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
 const last = true`

test("dragging unified line numbers comments on the picked lines", async () => {
  await using setup = await renderComment({ view: "unified", width: 80 })
  const app = setup.app
  const side = diffSides(app.renderer.root)[0]!
  const removed = rowOf(app, "const oldFirst")
  const original = background(app, removed)

  await app.mockMouse.click(side.x + side.width - 2, removed)
  await app.flush()
  expect(app.captureCharFrame()).not.toContain("Leave a comment")
  app.renderer.clearSelection()

  await app.mockMouse.drag(side.x + 1, removed, side.x + 1, rowOf(app, "const afterFirst"))
  await app.waitForFrame(
    (frame) => frame.includes("Leave a comment") && app.renderer.currentFocusedRenderable instanceof TextareaRenderable,
  )
  expect(app.captureCharFrame()).toContain("src/file.txt L2-L3")
  expect(background(app, removed)).not.toBe(original)
  expect(background(app, removed + 1)).toBe(background(app, removed))
  expect(background(app, removed + 2)).toBe(background(app, removed))
  expect(background(app, removed - 1)).not.toBe(background(app, removed))

  app.mockInput.typeText("Rename it")
  app.mockInput.pressEnter()
  await app.waitForFrame(() => setup.sent.length === 1 && background(app, removed) === original)
  expect(setup.sent).toEqual([
    [
      "Review comment on src/file.txt L2-L3:",
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

test("split line numbers comment on one side and cancelling sends nothing", async () => {
  await using setup = await renderComment({ view: "split", width: 160 })
  const app = setup.app
  const [left, right] = diffSides(app.renderer.root)
  const row = rowOf(app, "const newFirst")

  await app.mockMouse.click(left!.x + 1, row)
  await app.waitForFrame((frame) => frame.includes("src/file.txt L2 (removed)"))
  app.mockInput.pressEscape()
  await app.waitForFrame((frame) => !frame.includes("Leave a comment"))

  await app.mockMouse.drag(right!.x + 1, row, right!.x + 1, row + 1)
  await app.waitForFrame(
    (frame) =>
      frame.includes("src/file.txt L2-L3") && app.renderer.currentFocusedRenderable instanceof TextareaRenderable,
  )
  app.mockInput.typeText("Why?")
  app.mockInput.pressEnter()
  await app.waitForFrame(() => setup.sent.length === 1)
  expect(setup.sent).toEqual([
    [
      "Review comment on src/file.txt L2-L3:",
      "",
      "```diff",
      "+const newFirst = true",
      " const afterFirst = true",
      "```",
      "",
      "Why?",
    ].join("\n"),
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
  const temporary = await tmpdir()
  const sent: string[] = []
  const lines: PatchLine[] = ["one", "two", "three"].map((text, index) => ({ kind: "add", text, newLine: index + 1 }))
  function Written() {
    const theme = useTheme()
    const comment = useLineComment()
    const selection = createLineSelection({
      select: () => (picked) =>
        comment({
          file: "notes.txt",
          lines: picked,
          send: async (text) => {
            sent.push(text)
          },
        }),
      color: () => theme.diff.background.selected,
      source: (target) =>
        target instanceof LineNumberRenderable ? { sides: [target], lineAt: (_, row) => lines[row] } : undefined,
    })
    return (
      <line_number fg={theme.text.muted} minWidth={3} paddingRight={1} {...selection}>
        <code
          fg={theme.text.base}
          syntaxStyle={useThemes().currentSyntax()}
          content={lines.map((line) => line.text).join("\n")}
        />
      </line_number>
    )
  }
  const app = await testRender(
    () => (
      <TestTuiContexts directory={temporary.path} paths={{ state: temporary.path }}>
        <ConfigProvider config={createTuiResolvedConfig()}>
          <ThemeProvider mode="dark" source={emptyThemeSource}>
            <Keymap.Provider>
              <ToastProvider>
                <DialogProvider>
                  <Written />
                </DialogProvider>
              </ToastProvider>
            </Keymap.Provider>
          </ThemeProvider>
        </ConfigProvider>
      </TestTuiContexts>
    ),
    { width: 80, height: 24, kittyKeyboard: true },
  )
  try {
    app.renderer.start()
    await app.waitForFrame((frame) => frame.includes("three"))
    const original = background(app, rowOf(app, "two"))
    await app.mockMouse.drag(0, rowOf(app, "two"), 0, rowOf(app, "three"))
    await app.waitForFrame(
      (frame) =>
        frame.includes("notes.txt L2-L3") && app.renderer.currentFocusedRenderable instanceof TextareaRenderable,
    )
    expect(background(app, rowOf(app, "two"))).not.toBe(original)
    app.mockInput.typeText("Trim")
    app.mockInput.pressEnter()
    await app.waitForFrame(() => sent.length === 1)
    expect(sent).toEqual(["Review comment on notes.txt L2-L3:\n\n```diff\n+two\n+three\n```\n\nTrim"])
  } finally {
    app.renderer.destroy()
    await temporary[Symbol.asyncDispose]()
  }
})

async function renderComment(options: { view: "unified" | "split"; width: number; comment?: boolean }) {
  const temporary = await tmpdir()
  const sent: string[] = []
  function Diff() {
    const theme = useTheme()
    const comment = useLineComment()
    return (
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
        onSelectLines={
          options.comment === false
            ? undefined
            : (lines) =>
                comment({
                  file: "src/file.txt",
                  lines,
                  send: async (text) => {
                    sent.push(text)
                  },
                })
        }
      />
    )
  }
  const app = await testRender(
    () => (
      <TestTuiContexts directory={temporary.path} paths={{ state: temporary.path }}>
        <ConfigProvider config={createTuiResolvedConfig()}>
          <ThemeProvider mode="dark" source={emptyThemeSource}>
            <Keymap.Provider>
              <ToastProvider>
                <DialogProvider>
                  <Diff />
                </DialogProvider>
              </ToastProvider>
            </Keymap.Provider>
          </ThemeProvider>
        </ConfigProvider>
      </TestTuiContexts>
    ),
    { width: options.width, height: 24, kittyKeyboard: true },
  )
  app.renderer.start()
  await app.waitForFrame((frame) => frame.includes("const newFirst"))
  return {
    app,
    sent,
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

function rowOf(app: Awaited<ReturnType<typeof testRender>>, text: string) {
  return app
    .captureCharFrame()
    .split("\n")
    .findIndex((line) => line.includes(text))
}

/** The background of the row's line-number gutter. */
function background(app: Awaited<ReturnType<typeof testRender>>, row: number) {
  return `${app.captureSpans().lines[row]?.spans[0]?.bg}`
}
