/** @jsxImportSource @opentui/solid */
import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { SyntaxStyle } from "@opentui/core"
import { ManualClock } from "@opentui/core/testing"
import { testRender, useRenderer } from "@opentui/solid"
import { linkDirectoryMarkdown } from "../../src/ui/directory-markdown"
import { clickedLink } from "../../src/ui/link"

const syntaxStyle = SyntaxStyle.fromStyles({ default: { fg: "#ffffff" } })
let root: string

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "directory-markdown-"))
  await mkdir(path.join(root, "worktree"))
  await writeFile(path.join(root, "file.txt"), "")
})

afterEach(() => rm(root, { recursive: true, force: true }))

test("inline code holding an existing absolute directory is a clickable link; files and missing paths are not", async () => {
  const directory = path.join(root, "worktree")
  const file = path.join(root, "file.txt")
  const missing = path.join(root, "missing")
  const opened: string[] = []
  function Transcript() {
    const renderer = useRenderer()
    return (
      <box
        onMouseUp={(event) => {
          const link = clickedLink(renderer, event)
          if (link) opened.push(link)
        }}
      >
        <markdown
          ref={linkDirectoryMarkdown}
          syntaxStyle={syntaxStyle}
          conceal
          content={`Dir \`${directory}\`\n\nFile \`${file}\`\n\nGone \`${missing}\``}
        />
      </box>
    )
  }
  const app = await testRender(() => <Transcript />, { width: 120, height: 10, clock: new ManualClock() })

  try {
    for (let attempt = 0; attempt < 50 && !app.captureCharFrame().includes("Gone"); attempt++) {
      await app.renderOnce()
      await Bun.sleep(10)
    }
    await Bun.sleep(50)
    await app.renderOnce()
    const rows = app.captureCharFrame().split("\n")
    const at = (label: string) => {
      const y = rows.findIndex((row) => row.includes(label))
      return [rows[y]!.indexOf("/"), y] as const
    }

    await app.mockMouse.click(...at("Dir"))
    await app.mockMouse.click(...at("File"))
    await app.mockMouse.click(...at("Gone"))

    expect(opened).toEqual([directory])
  } finally {
    app.renderer.destroy()
  }
})
