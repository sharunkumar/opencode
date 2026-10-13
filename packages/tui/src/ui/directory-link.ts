import { execFile } from "node:child_process"
import { stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import type { ClipboardService } from "../context/clipboard"

const run = promisify(execFile)

/** A directory link is a relative, absolute, or `~/` path with a trailing slash, such as `packages/core/`. */
export function directoryLinkPath(href: string, base: string) {
  if (!href.endsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(href)) return
  return path.resolve(href.startsWith("~/") ? os.homedir() : base, href.startsWith("~/") ? href.slice(2) : href)
}

/** Copies the directory path, then opens it in Sublime Merge. Rejects when it is not an existing directory. */
export async function openDirectoryLink(directory: string, clipboard: ClipboardService) {
  if (!(await stat(directory)).isDirectory()) throw new Error(`Not a directory: ${directory}`)
  await clipboard.write(directory)
  await run("smerge", [directory])
}
