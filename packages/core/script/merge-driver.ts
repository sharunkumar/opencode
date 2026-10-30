#!/usr/bin/env bun

// Git merge driver for the two generated migration files that conflict whenever both branches add a migration.
// Configure with `make git-setup`; `.gitattributes` maps the files to these drivers.
// Usage: bun packages/core/script/merge-driver.ts <registry|snapshot> <base> <ours> <theirs>

import fs from "fs/promises"
import os from "os"
import path from "path"

/** Keeps every migration either side has, minus ones either side deleted, renumbered in timestamp order. */
export function mergeRegistry(base: string, ours: string, theirs: string) {
  const kept = { ours: migrationNames(ours), theirs: migrationNames(theirs) }
  const removed = new Set(
    migrationNames(base).filter((name) => !kept.ours.includes(name) || !kept.theirs.includes(name)),
  )
  return renderRegistry([...new Set([...kept.ours, ...kept.theirs])].filter((name) => !removed.has(name)).sort())
}

/**
 * Merges the snapshot DDL textually and resolves the `id` / `prevIds` header that both sides rewrite on every
 * migration: a new id whose parents are both sides' snapshots. Leaves conflict markers when the DDL itself conflicts.
 */
export async function mergeSnapshot(base: string, ours: string, theirs: string) {
  const ids = { base: snapshotID(base), ours: snapshotID(ours), theirs: snapshotID(theirs) }
  const merged = await mergeText(withoutHeader(base), withoutHeader(ours), withoutHeader(theirs))
  const header = (() => {
    if (ids.ours === ids.theirs || ids.theirs === ids.base) return headerOf(ours)
    if (ids.ours === ids.base) return headerOf(theirs)
    return `  "id": "${crypto.randomUUID()}",\n  "prevIds": ["${ids.ours}", "${ids.theirs}"],`
  })()
  return { text: merged.text.replace(PLACEHOLDER, header), clean: merged.clean }
}

const HEADER = /^ {2}"id": "([^"]+)",\n {2}"prevIds": \[[^\]]*\],$/m
const PLACEHOLDER = '  "id": "",\n  "prevIds": [],'

function snapshotID(text: string) {
  const match = HEADER.exec(text)
  if (!match) throw new Error("schema.json has no id/prevIds header")
  return match[1]
}

function headerOf(text: string) {
  return HEADER.exec(text)![0]
}

function withoutHeader(text: string) {
  return text.replace(HEADER, PLACEHOLDER)
}

function migrationNames(text: string) {
  return [...text.matchAll(/^import m\d+ from "\.\/migration\/(.+)\.js"$/gm)].map((match) => match[1])
}

// Must match renderRegistry in script/migration.ts, which cannot be imported because it generates on load.
function renderRegistry(names: string[]) {
  return `import type { DatabaseMigration } from "./migration.js"
${names.map((name, index) => `import m${index.toString().padStart(2, "0")} from "./migration/${name}.js"`).join("\n")}

export const migrations = [
${names.map((_, index) => `  m${index.toString().padStart(2, "0")},`).join("\n")}
] satisfies DatabaseMigration.Migration[]
`
}

async function mergeText(base: string, ours: string, theirs: string) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-merge-driver-"))
  try {
    const file = (name: string) => path.join(directory, name)
    await Promise.all([Bun.write(file("ours"), ours), Bun.write(file("base"), base), Bun.write(file("theirs"), theirs)])
    const result = Bun.spawnSync(
      [
        "git",
        "merge-file",
        "-p",
        "--diff3",
        "-L",
        "ours",
        "-L",
        "base",
        "-L",
        "theirs",
        file("ours"),
        file("base"),
        file("theirs"),
      ],
      { stdout: "pipe", stderr: "pipe" },
    )
    if (result.exitCode < 0 || result.exitCode > 127)
      throw new Error(`git merge-file failed: ${result.stderr.toString()}`)
    return { text: result.stdout.toString(), clean: result.exitCode === 0 }
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
}

// Last, so the constants above are initialized before a git invocation uses them.
if (import.meta.main) {
  const [kind, basePath, oursPath, theirsPath] = process.argv.slice(2)
  if ((kind !== "registry" && kind !== "snapshot") || !basePath || !oursPath || !theirsPath) {
    console.error("usage: merge-driver.ts <registry|snapshot> <base> <ours> <theirs>")
    process.exit(2)
  }
  const [base, ours, theirs] = await Promise.all([basePath, oursPath, theirsPath].map((file) => Bun.file(file).text()))
  const result =
    kind === "registry"
      ? { text: mergeRegistry(base, ours, theirs), clean: true }
      : await mergeSnapshot(base, ours, theirs)
  await Bun.write(oursPath, result.text)
  process.exit(result.clean ? 0 : 1)
}
