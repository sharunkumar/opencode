import { statSync } from "node:fs"
import type { MarkdownInlineHook, MarkdownInlineSpan, MarkdownRenderable } from "@opentui/core"
import { directoryLinkPath } from "./directory-link"

/** Source text that can hold an inline-code directory path; the hook runs only on blocks that contain one. */
export const directoryHookFilter = ["`/", "`~/"] as const

/** Links an inline code span holding an existing absolute directory so a click opens it like a directory link. */
export function linkDirectorySpan(span: MarkdownInlineSpan): MarkdownInlineSpan {
  if (!span.code || span.link) return span
  const text = span.text.replace(/^`+\s?|\s?`+$/g, "")
  if (!/^(\/|~\/)\S*$/.test(text)) return span
  const directory = directoryLinkPath(text, "/")
  if (!directory || !isDirectory(directory)) return span
  return { ...span, link: { url: text } }
}

export const directoryHook: MarkdownInlineHook = (spans, context) => (context.tableCell ? spans : spans.map(linkDirectorySpan))

export function linkDirectoryMarkdown(renderable: MarkdownRenderable) {
  renderable.inlineHook = directoryHook
  renderable.inlineHookFilter = directoryHookFilter
}

function isDirectory(directory: string) {
  return statSync(directory, { throwIfNoEntry: false })?.isDirectory() === true
}
