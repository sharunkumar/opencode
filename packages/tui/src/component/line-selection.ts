import {
  CodeRenderable,
  DiffRenderable,
  LineNumberRenderable,
  MouseButton,
  type ColorInput,
  type MouseEvent,
  type Renderable,
} from "@opentui/core"
import { patchLines, type PatchLine } from "../util/diff"

/** The line-numbered sides of a renderable, and the line each logical row of a side shows. */
export interface LineSource {
  readonly sides: readonly LineNumberRenderable[]
  readonly lineAt: (side: LineNumberRenderable, row: number) => PatchLine | undefined
}

type LineDrag = {
  readonly source: LineSource
  readonly side: LineNumberRenderable
  readonly anchor: number
}

type PaintedSide = {
  readonly side: LineNumberRenderable
  readonly rows: readonly number[]
  readonly saved: ReturnType<LineNumberRenderable["getLineColors"]>
}

/**
 * Mouse handlers that let a press or drag on line numbers pick lines. Spread them on the renderable `source` reads.
 * The picked lines stay painted in `color` until the promise `select` returns settles. Only presses on the line
 * numbers pick lines, so a press on the code still starts a text selection, and a drag stays on the side it started in.
 */
export function createLineSelection(options: {
  readonly select: () => ((lines: readonly PatchLine[]) => Promise<unknown>) | undefined
  readonly color: () => ColorInput | undefined
  readonly source: (target: Renderable) => LineSource | undefined
}) {
  const state: { drag?: LineDrag; painted: readonly PaintedSide[] } = { painted: [] }

  const restore = () => {
    state.painted.forEach((entry) => {
      if (entry.side.isDestroyed) return
      entry.rows.forEach((row) => {
        entry.side.clearLineColor(row)
        const gutter = entry.saved.gutter.get(row)
        const content = entry.saved.content.get(row)
        if (gutter && content) entry.side.setLineColor(row, { gutter, content })
      })
    })
    state.painted = []
  }

  const paint = (drag: LineDrag, picked: readonly PatchLine[]) => {
    restore()
    const background = options.color()
    if (!background) return
    state.painted = drag.source.sides.map((side) => {
      const saved = side.getLineColors()
      const rows = Array.from({ length: codeOf(side)?.lineCount ?? 0 }, (_, row) => row).filter((row) => {
        const line = drag.source.lineAt(side, row)
        return line !== undefined && picked.includes(line)
      })
      rows.forEach((row) => side.setLineColor(row, { gutter: background, content: background }))
      return { side, rows, saved }
    })
  }

  const pick = (drag: LineDrag, y: number) => {
    const row = rowAt(drag.side, y)
    if (row === undefined) return []
    const first = Math.min(row, drag.anchor)
    const lines = Array.from({ length: Math.abs(row - drag.anchor) + 1 }, (_, index) =>
      drag.source.lineAt(drag.side, first + index),
    ).filter((line): line is PatchLine => line !== undefined)
    return [...new Set(lines)]
  }

  return {
    onMouseDown(event: MouseEvent) {
      if (event.button !== MouseButton.LEFT || !options.select() || !event.currentTarget) return
      const source = options.source(event.currentTarget)
      const side = source?.sides.find((side) => event.x >= side.x && event.x < (codeOf(side)?.x ?? side.x))
      const anchor = side && rowAt(side, event.y)
      if (!source || !side || anchor === undefined) return
      event.stopPropagation()
      state.drag = { source, side, anchor }
      paint(state.drag, pick(state.drag, event.y))
    },
    onMouseDrag(event: MouseEvent) {
      if (!state.drag) return
      event.stopPropagation()
      paint(state.drag, pick(state.drag, event.y))
    },
    onMouseUp(event: MouseEvent) {
      const drag = state.drag
      if (!drag) return
      state.drag = undefined
      event.stopPropagation()
      const picked = pick(drag, event.y)
      const handler = options.select()
      if (picked.length === 0 || !handler) return restore()
      paint(drag, picked)
      void handler(picked).then(restore, restore)
    },
  }
}

// The unified view lists the patch lines in order. Split sides interleave padding rows, so match by line number:
// the left side shows removed and context lines, the right side added and context lines.
export function diffLineSource(target: Renderable): LineSource | undefined {
  if (!(target instanceof DiffRenderable)) return
  const lines = patchLines(target.diff)
  const sides = target
    .getChildren()
    .filter((child): child is LineNumberRenderable => child instanceof LineNumberRenderable)
  return {
    sides,
    lineAt(side, row) {
      if (target.view !== "split") return lines[row]
      const number = side.getHideLineNumbers().has(row) ? undefined : side.getLineNumbers().get(row)
      if (number === undefined) return
      return lines.find((line) =>
        side === sides[0]
          ? line.kind !== "add" && line.oldLine === number
          : line.kind !== "remove" && line.newLine === number,
      )
    },
  }
}

function codeOf(side: LineNumberRenderable) {
  return side.getChildren().find((child): child is CodeRenderable => child instanceof CodeRenderable)
}

/** The logical row of the side's code under screen row `y`, clamped to the code's rows. */
function rowAt(side: LineNumberRenderable, y: number) {
  const code = codeOf(side)
  const sources = code?.lineInfo.lineSources ?? []
  if (!code || sources.length === 0) return
  return sources[Math.max(0, Math.min(sources.length - 1, y - code.y + code.scrollY))]
}
