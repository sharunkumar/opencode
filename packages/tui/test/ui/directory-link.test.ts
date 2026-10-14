import { afterEach, beforeEach, expect, test } from "bun:test"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { directoryLinkPath, openDirectoryLink } from "../../src/ui/directory-link"

const originalPath = process.env.PATH
let root: string
let copied: string[]

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "directory-link-"))
  copied = []
  await mkdir(path.join(root, "bin"))
  await writeFile(path.join(root, "bin", "smerge"), `#!/bin/sh\nprintf '%s' "$1" > "${root}/launched"\n`)
  await chmod(path.join(root, "bin", "smerge"), 0o755)
  process.env.PATH = `${path.join(root, "bin")}${path.delimiter}${originalPath}`
})

afterEach(async () => {
  process.env.PATH = originalPath
  await rm(root, { recursive: true, force: true })
})

const clipboard = () => ({
  read: async () => undefined,
  write: async (text: string) => void copied.push(text),
})

test.each([
  ["relative", "packages/core/", "/work", "/work/packages/core"],
  ["parent", "../shared/", "/work/app", "/work/shared"],
  ["absolute", "/etc/hosts.d/", "/work", "/etc/hosts.d"],
  ["home", "~/src/", "/work", path.join(os.homedir(), "src")],
  ["absolute without trailing slash", "/var/folders/x/worktree", "/work", "/var/folders/x/worktree"],
  ["home without trailing slash", "~/src", "/work", path.join(os.homedir(), "src")],
  ["relative without trailing slash", "packages/core", "/work", undefined],
  ["web link", "https://example.com/docs/", "/work", undefined],
  ["file url", "file:///tmp/", "/work", undefined],
])("directory link path: %s", (_name, href, base, expected) => {
  expect(directoryLinkPath(href, base)).toBe(expected)
})

test("opening a directory link copies its path and launches smerge on it", async () => {
  const directory = path.join(root, "project")
  await mkdir(directory)

  await openDirectoryLink(directory, clipboard())

  expect(copied).toEqual([directory])
  expect(await readFile(path.join(root, "launched"), "utf8")).toBe(directory)
})

test("a missing path or a file is rejected without copying or launching", async () => {
  await writeFile(path.join(root, "file.txt"), "")

  await expect(openDirectoryLink(path.join(root, "missing"), clipboard())).rejects.toThrow()
  await expect(openDirectoryLink(path.join(root, "file.txt"), clipboard())).rejects.toThrow("Not a directory")

  expect(copied).toEqual([])
  expect(await Bun.file(path.join(root, "launched")).exists()).toBe(false)
})
