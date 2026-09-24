import { describe, expect, test } from "bun:test"
import {
  createDialogSessionListQuery,
  loadDialogSessionList,
  sessionPreviewLines,
} from "../../src/component/dialog-session-list"

describe("dialog session list", () => {
  test("requests root sessions for the default browse list", () => {
    expect(createDialogSessionListQuery({ filter: { path: "packages/tui" } })).toEqual({
      roots: true,
      limit: 100,
      path: "packages/tui",
    })
  })

  test("requests root sessions for search results", () => {
    expect(createDialogSessionListQuery({ search: " deploy ", filter: { scope: "project" } })).toEqual({
      roots: true,
      limit: 30,
      search: "deploy",
      scope: "project",
    })
  })

  test("keeps the cache usable while the root request is pending", async () => {
    let resolve!: (result: { data: string[] }) => void
    const pending = loadDialogSessionList<string>({
      filter: {},
      list: () => new Promise((done) => (resolve = done)),
    })

    expect(await Promise.race([pending, Promise.resolve("pending")])).toBe("pending")
    resolve({ data: ["root"] })
    expect(await pending).toEqual(["root"])
  })

  test("falls back when the root request returns an error response", async () => {
    expect(await loadDialogSessionList({ filter: {}, list: async () => ({}) })).toBeUndefined()
  })

  test("keeps the last user and assistant text for the preview", () => {
    expect(
      sessionPreviewLines([
        { info: { role: "user" }, parts: [{ type: "text", text: "fix the picker" }] },
        {
          info: { role: "assistant" },
          parts: [
            { type: "text", text: "done", synthetic: true },
            { type: "reasoning", text: "think" },
            { type: "text", text: "updated the list" },
          ],
        },
      ] as never),
    ).toEqual([
      { role: "assistant", text: "updated the list" },
      { role: "you", text: "fix the picker" },
    ])
  })

  test("falls back when the root request rejects", async () => {
    expect(
      await loadDialogSessionList({
        filter: {},
        list: () => Promise.reject(new Error("offline")),
      }),
    ).toBeUndefined()
  })
})
