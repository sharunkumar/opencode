import { stat } from "node:fs/promises"
import { CodeRenderable, Renderable } from "@opentui/core"
import { directoryLinkPath } from "./directory-link"

const hooked = new WeakSet<Renderable>()

type OnChunks = NonNullable<CodeRenderable["onChunks"]>

/** Links inline code spans holding an existing absolute directory so a click opens it like a directory link. */
export function linkDirectoryMarkdown(renderable: Renderable) {
  if (hooked.has(renderable)) return
  hooked.add(renderable)
  const add = renderable.add.bind(renderable)
  renderable.add = (child, index) => {
    if (child instanceof Renderable) linkDirectoryMarkdown(child)
    return add(child, index)
  }
  if (renderable instanceof CodeRenderable && renderable.filetype === "markdown") linkCode(renderable)
  renderable.getChildren().forEach(linkDirectoryMarkdown)
}

function linkCode(renderable: CodeRenderable) {
  const onChunks = renderable.onChunks
  renderable.onChunks = async (chunks, context) =>
    linkDirectorySpans((await onChunks?.(chunks, context)) ?? chunks, context)
  const content = renderable.content
  renderable.content = ""
  renderable.content = content
}

async function linkDirectorySpans(chunks: Parameters<OnChunks>[0], context: Parameters<OnChunks>[1]) {
  const candidates = context.highlights.flatMap(([start, end, group]) => {
    if (group !== "markup.raw" && !group.startsWith("markup.raw.")) return []
    const text = context.content.slice(start, end).replace(/^`+|`+$/g, "")
    return /^(\/|~\/)\S*$/.test(text) ? [text] : []
  })
  if (candidates.length === 0) return chunks
  const directories = new Set(
    (
      await Promise.all(
        [...new Set(candidates)].map(async (text) => {
          const directory = directoryLinkPath(text, "/")
          if (!directory) return
          return (await stat(directory).catch(() => undefined))?.isDirectory() ? text : undefined
        }),
      )
    ).filter((text) => text !== undefined),
  )
  return chunks.map((chunk) => (directories.has(chunk.text) && !chunk.link ? { ...chunk, link: { url: chunk.text } } : chunk))
}
