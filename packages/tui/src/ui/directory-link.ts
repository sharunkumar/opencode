import { execFile } from "node:child_process"
import { stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import type { ClipboardService } from "../context/clipboard"

const run = promisify(execFile)

/** A directory link is an absolute or `~/` path, or a relative path with a trailing slash such as `packages/core/`. */
export function directoryLinkPath(href: string, base: string) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return
  const home = href.startsWith("~/")
  if (!home && !href.startsWith("/") && !href.endsWith("/")) return
  return path.resolve(home ? os.homedir() : base, home ? href.slice(2) : href)
}

/** Copies the directory path, then opens it in Sublime Merge. Rejects when it is not an existing directory. */
export async function openDirectoryLink(directory: string, clipboard: ClipboardService) {
  if (!(await stat(directory)).isDirectory()) throw new Error(`Not a directory: ${directory}`)
  await clipboard.write(directory)
  await run("smerge", [directory])
}
