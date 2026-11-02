import {
  CodeRenderable,
  DiffRenderable,
  LineNumberRenderable,
  MouseButton,
  parseColor,
  TextAttributes,
  type ColorInput,
  type MouseEvent,
  type OptimizedBuffer,
  type Renderable,
} from "@opentui/core"
import { patchLines, type PatchLine } from "../util/diff"

/** The line-numbered sides of a renderable, and the line each logical row of a side shows. */
export interface LineSource {
  readonly sides: readonly LineNumberRenderable[]
  readonly lineAt: (side: LineNumberRenderable, row: number) => PatchLine | undefined
}

/** The row just below the picked lines, `offset` rows below the top of `target`, the renderable they were picked on. */
export interface LineAnchor {
  readonly target: Renderable
  readonly offset: number
}

type LineDrag = {
  readonly target: Renderable
  readonly source: LineSource
  readonly side: LineNumberRenderable
  readonly anchor: number
}

type PaintedSide = {
  readonly side: LineNumberRenderable
  readonly rows: readonly number[]
  readonly saved: ReturnType<LineNumberRenderable["getLineColors"]>
}

type Hover = { readonly side: LineNumberRenderable; readonly row: number }

/**
 * Mouse handlers that let a press or drag on line numbers pick lines, like starting a review comment on GitHub.
 * Spread them on the renderable `source` reads; `select` also receives where the picked lines end. Hovering a line
 * shows a `+` in the gutter's first column; a drag grows or shrinks a bar there with the `+` on its top line, and paints
 * the picked lines in `color`. Both stay until the promise `select` returns settles. Only presses on the line numbers
 * pick lines, so a press on the code still starts a text selection, and a drag stays on the side it started in.
 */
export function createLineSelection(options: {
  readonly select: () => ((lines: readonly PatchLine[], anchor: LineAnchor) => Promise<unknown>) | undefined
  readonly color: () => ColorInput | undefined
  readonly marker: () => ColorInput | undefined
  readonly source: (target: Renderable) => LineSource | undefined
}) {
  const state: { drag?: LineDrag; hover?: Hover; painted: readonly PaintedSide[] } = { painted: [] }
  const decorated = new WeakSet<Renderable>()

  // The bar draws over the gutter's left padding after the gutter paints, so it never shifts the line numbers.
  const drawMarkers = (side: LineNumberRenderable, gutter: Renderable, buffer: OptimizedBuffer) => {
    const color = options.marker()
    const code = codeOf(side)
    const painted = state.painted.find((entry) => entry.side === side)?.rows ?? []
    const hovered = state.painted.length === 0 && state.hover?.side === side ? [state.hover.row] : []
    const rows = painted.length > 0 ? painted : hovered
    if (!color || !code || rows.length === 0) return
    const fg = parseColor(color)
    const top = Math.min(...rows)
    const sources = code.lineInfo.lineSources
    sources.forEach((row, visual) => {
      if (!rows.includes(row)) return
      const first = sources[visual - 1] !== row
      if (painted.length === 0 && !first) return
      const plus = row === top && first
      buffer.drawText(
        plus ? "+" : "▌",
        gutter.x,
        gutter.y + visual - code.scrollY,
        fg,
        undefined,
        plus ? TextAttributes.BOLD : 0,
      )
    })
  }

  const refresh = (sides: readonly LineNumberRenderable[]) =>
    sides.forEach((side) => {
      const gutter = gutterOf(side)
      if (!gutter || side.isDestroyed) return
      if (!decorated.has(gutter)) {
        decorated.add(gutter)
        gutter.renderAfter = function (buffer) {
          drawMarkers(side, this, buffer)
        }
      }
      gutter.requestRender()
    })

  const hover = (next: Hover | undefined) => {
    const previous = state.hover
    if (previous?.side === next?.side && previous?.row === next?.row) return
    state.hover = next
    refresh([previous?.side, next?.side].filter((side) => side !== undefined))
  }

  const restore = () => {
    const sides = state.painted.map((entry) => entry.side)
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
    refresh(sides)
  }

  const paint = (drag: LineDrag, picked: readonly PatchLine[]) => {
    restore()
    const background = options.color()
    state.painted = drag.source.sides.map((side) => {
      const saved = side.getLineColors()
      const rows = Array.from({ length: codeOf(side)?.lineCount ?? 0 }, (_, row) => row).filter((row) => {
        const line = drag.source.lineAt(side, row)
        return line !== undefined && picked.includes(line)
      })
      if (background) rows.forEach((row) => side.setLineColor(row, { gutter: background, content: background }))
      return { side, rows, saved }
    })
    refresh(drag.source.sides)
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
    onMouseMove(event: MouseEvent) {
      if (!options.select() || state.drag || !event.currentTarget) return
      const source = options.source(event.currentTarget)
      const side = source?.sides.find((side) => event.x >= side.x && event.x < side.x + side.width)
      const row = side && rowAt(side, event.y)
      hover(source && side && row !== undefined && source.lineAt(side, row) ? { side, row } : undefined)
    },
    onMouseOut() {
      hover(undefined)
    },
    onMouseDown(event: MouseEvent) {
      const target = event.currentTarget
      if (event.button !== MouseButton.LEFT || !options.select() || !target) return
      const source = options.source(target)
      const side = source?.sides.find((side) => event.x >= side.x && event.x < (codeOf(side)?.x ?? side.x))
      const anchor = side && rowAt(side, event.y)
      if (!source || !side || anchor === undefined) return
      event.stopPropagation()
      hover(undefined)
      state.drag = { target, source, side, anchor }
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
      // A newer pick replaces this one's marks; settling this one must not clear them.
      const painted = state.painted
      const done = () => {
        if (state.painted === painted) restore()
      }
      void handler(picked, anchorBelow(drag, picked.at(-1))).then(done, done)
    },
  }
}

const diffLines = new WeakMap<DiffRenderable, { readonly diff: string; readonly lines: readonly PatchLine[] }>()

// The unified view lists the patch lines in order. Split sides interleave padding rows, so match by line number:
// the left side shows removed and context lines, the right side added and context lines.
export function diffLineSource(target: Renderable): LineSource | undefined {
  if (!(target instanceof DiffRenderable)) return
  const sides = target
    .getChildren()
    .filter((child): child is LineNumberRenderable => child instanceof LineNumberRenderable)
  const lines = () => {
    const cached = diffLines.get(target)
    if (cached?.diff === target.diff) return cached.lines
    const next = { diff: target.diff, lines: patchLines(target.diff) }
    diffLines.set(target, next)
    return next.lines
  }
  return {
    sides,
    lineAt(side, row) {
      if (target.view !== "split") return lines()[row]
      const number = side.getHideLineNumbers().has(row) ? undefined : side.getLineNumbers().get(row)
      if (number === undefined) return
      return lines().find((line) =>
        side === sides[0]
          ? line.kind !== "add" && line.oldLine === number
          : line.kind !== "remove" && line.newLine === number,
      )
    },
  }
}

/** Anchors below the last screen row of `line`, which wraps onto several rows when it is long. */
function anchorBelow(drag: LineDrag, line: PatchLine | undefined): LineAnchor {
  const code = codeOf(drag.side)
  const sources = code?.lineInfo.lineSources ?? []
  const last = sources.findLastIndex((row) => drag.source.lineAt(drag.side, row) === line)
  if (!code || last === -1) return { target: drag.target, offset: drag.target.height }
  return { target: drag.target, offset: code.y + last - code.scrollY + 1 - drag.target.y }
}

function codeOf(side: LineNumberRenderable) {
  return side.getChildren().find((child): child is CodeRenderable => child instanceof CodeRenderable)
}

// A LineNumberRenderable holds its gutter and its code; the gutter is the child that is not the code.
function gutterOf(side: LineNumberRenderable) {
  return side.getChildren().find((child) => !(child instanceof CodeRenderable))
}

/** The logical row of the side's code under screen row `y`, clamped to the code's rows. */
function rowAt(side: LineNumberRenderable, y: number) {
  const code = codeOf(side)
  const sources = code?.lineInfo.lineSources ?? []
  if (!code || sources.length === 0) return
  return sources[Math.max(0, Math.min(sources.length - 1, y - code.y + code.scrollY))]
}
