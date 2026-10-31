export interface PatchHunk {
  readonly patch: string
  readonly header?: string
  readonly rows?: number
}

export interface AddedPatchChunk {
  readonly patch: string
  readonly lines: readonly string[]
  readonly rows: number
}

/**
 * Splits a new-file patch into chunks of `size` lines, each a valid patch with its own `@@ -0,0 +start,count @@`
 * header. Returns undefined for anything else: patches with context or removed lines would need old and new line
 * numbers recomputed at every cut, so they are not split.
 */
export function splitAddedPatch(patch: string, size: number): AddedPatchChunk[] | undefined {
  const header = /^@@ -0,0 \+1,(\d+) @@[^\n]*\n/m.exec(patch)
  if (!header) return
  const count = Number(header[1])
  const lines = patch
    .slice(header.index + header[0].length)
    .replace(/\n$/, "")
    .split("\n")
  const marker = lines.at(-1)?.startsWith("\\ No newline at end of file") ? lines.pop() : undefined
  if (lines.length !== count || lines.some((line) => !line.startsWith("+"))) return
  const prefix = patch.slice(0, header.index)
  return Array.from({ length: Math.ceil(count / size) }, (_, index) => {
    const start = index * size
    const slice = lines.slice(start, start + size)
    return {
      patch: `${prefix}@@ -0,0 +${start + 1},${slice.length} @@\n${slice.join("\n")}${marker && start + size >= count ? `\n${marker}` : ""}`,
      lines: slice,
      rows: slice.length,
    }
  })
}

export interface PatchLine {
  readonly kind: "add" | "remove" | "context"
  readonly text: string
  readonly oldLine?: number
  readonly newLine?: number
}

/** Lists the lines of every hunk in the order DiffRenderable's unified view shows them, with their file line numbers. */
export function patchLines(patch: string): PatchLine[] {
  const lines: PatchLine[] = []
  const next = { old: 0, new: 0, hunk: false }
  for (const line of patch.split("\n")) {
    const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (header) {
      next.old = Number(header[1])
      next.new = Number(header[2])
      next.hunk = true
      continue
    }
    if (!next.hunk) continue
    const text = line.slice(1)
    if (line[0] === "+") lines.push({ kind: "add", text, newLine: next.new++ })
    if (line[0] === "-") lines.push({ kind: "remove", text, oldLine: next.old++ })
    if (line[0] === " ") lines.push({ kind: "context", text, oldLine: next.old++, newLine: next.new++ })
  }
  return lines
}

export function splitPatchHunks(patch: string): PatchHunk[] {
  const starts = [...patch.matchAll(/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@.*$/gm)].map((match) => match.index)
  if (starts.length <= 1) return [{ patch }]

  const prefix = patch.slice(0, starts[0])
  return starts.map((start, index) => {
    const end = starts[index + 1] ?? patch.length
    const lineEnd = patch.indexOf("\n", start)
    return {
      header: patch.slice(start, lineEnd === -1 ? end : lineEnd),
      patch: prefix + patch.slice(start, end),
      rows: splitRows(patch.slice(start, end)),
    }
  })
}

function splitRows(hunk: string) {
  const lines = hunk.replace(/\n$/, "").split("\n").slice(1)
  let rows = 0
  let index = 0

  while (index < lines.length) {
    const prefix = lines[index][0]
    if (prefix === " " || !prefix) {
      rows++
      index++
      continue
    }
    if (prefix === "\\") {
      index++
      continue
    }

    let additions = 0
    let deletions = 0
    while (index < lines.length && (lines[index][0] === "+" || lines[index][0] === "-")) {
      if (lines[index][0] === "+") additions++
      if (lines[index][0] === "-") deletions++
      index++
    }
    rows += Math.max(additions, deletions)
  }

  return rows
}
