import { describe, expect, test } from "bun:test"
import path from "path"
import { mergeRegistry, mergeSnapshot } from "../script/merge-driver"
import { tmpdir } from "./fixture/tmpdir"

const registry = (...names: string[]) =>
  [
    `import type { DatabaseMigration } from "./migration.js"`,
    ...names.map((name, index) => `import m${index.toString().padStart(2, "0")} from "./migration/${name}.js"`),
    "",
    "export const migrations = [",
    ...names.map((_, index) => `  m${index.toString().padStart(2, "0")},`),
    "] satisfies DatabaseMigration.Migration[]",
    "",
  ].join("\n")

const snapshot = (id: string, prevIds: string[], tables: string[]) =>
  [
    "{",
    `  "version": "7",`,
    `  "dialect": "sqlite",`,
    `  "id": "${id}",`,
    `  "prevIds": [${prevIds.map((prev) => `"${prev}"`).join(", ")}],`,
    `  "ddl": [`,
    ...tables.map((table) => `    { "name": "${table}", "entityType": "tables" },`),
    "  ]",
    "}",
    "",
  ].join("\n")

describe("merge driver: migration registry", () => {
  test("renders the checked-in registry unchanged", async () => {
    const current = await Bun.file(path.join(import.meta.dir, "../src/database/migration.gen.ts")).text()

    expect(mergeRegistry(current, current, current)).toBe(current)
  })

  test("keeps the fork's migration and upstream's new ones in timestamp order", () => {
    const base = registry("20260101_a", "20260201_b")
    const ours = registry("20260101_a", "20260201_b", "20260215_fork_roots")
    const theirs = registry("20260101_a", "20260201_b", "20260301_job", "20260302_schedule")

    expect(mergeRegistry(base, ours, theirs)).toBe(
      registry("20260101_a", "20260201_b", "20260215_fork_roots", "20260301_job", "20260302_schedule"),
    )
  })

  test("drops a migration that either side deleted", () => {
    const base = registry("20260101_a", "20260201_b")

    expect(mergeRegistry(base, registry("20260101_a", "20260201_b"), registry("20260101_a"))).toBe(
      registry("20260101_a"),
    )
  })
})

describe("merge driver: schema snapshot", () => {
  test("merges both sides' tables and points a new snapshot id at both parents", async () => {
    const base = snapshot("base", ["root"], ["account", "session"])
    const ours = snapshot("fork", ["base"], ["account", "session", "session_roots"])
    const theirs = snapshot("upstream", ["base"], ["account", "job", "session"])

    const merged = await mergeSnapshot(base, ours, theirs)

    expect(merged.clean).toBe(true)
    const parsed = JSON.parse(merged.text.replaceAll(",\n  ]", "\n  ]"))
    expect(parsed.prevIds).toEqual(["fork", "upstream"])
    expect(parsed.id).not.toBeOneOf(["base", "fork", "upstream"])
    expect(parsed.ddl.map((table: { name: string }) => table.name)).toEqual([
      "account",
      "job",
      "session",
      "session_roots",
    ])
  })

  test("keeps the changed side's header when only one side added a migration", async () => {
    const base = snapshot("base", ["root"], ["account"])
    const theirs = snapshot("upstream", ["base"], ["account", "job"])

    expect(await mergeSnapshot(base, base, theirs)).toEqual({ text: theirs, clean: true })
  })

  test("runs as a git merge driver and writes the result over ours", async () => {
    await using directory = await tmpdir()
    const file = (name: string) => path.join(directory.path, name)
    await Bun.write(file("base"), snapshot("base", ["root"], ["account", "session"]))
    await Bun.write(file("ours"), snapshot("fork", ["base"], ["account", "session", "session_roots"]))
    await Bun.write(file("theirs"), snapshot("upstream", ["base"], ["account", "job", "session"]))

    const result = Bun.spawnSync([
      process.execPath,
      path.join(import.meta.dir, "../script/merge-driver.ts"),
      "snapshot",
      file("base"),
      file("ours"),
      file("theirs"),
    ])

    expect(result.stderr.toString()).toBe("")
    expect(result.exitCode).toBe(0)
    expect(await Bun.file(file("ours")).text()).toContain('"prevIds": ["fork", "upstream"]')
  })

  test("leaves conflict markers when both sides change the same tables", async () => {
    const base = snapshot("base", ["root"], ["account"])
    const ours = snapshot("fork", ["base"], ["account_fork"])
    const theirs = snapshot("upstream", ["base"], ["account_upstream"])

    const merged = await mergeSnapshot(base, ours, theirs)

    expect(merged.clean).toBe(false)
    expect(merged.text).toContain("<<<<<<< ours")
    expect(merged.text).toContain('"prevIds": ["fork", "upstream"]')
  })
})
