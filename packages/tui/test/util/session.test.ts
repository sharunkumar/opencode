import { describe, expect, test } from "bun:test"
import { defaultComposerTab, sessionFamily } from "../../src/util/session"

describe("util.session", () => {
  test("flattens nested subagents from any session in the family", () => {
    const sessions = [
      { id: "root" },
      { id: "child-a", parentID: "root" },
      { id: "grandchild-a", parentID: "child-a" },
      { id: "great-grandchild-a", parentID: "grandchild-a" },
      { id: "grandchild-a2", parentID: "child-a" },
      { id: "child-b", parentID: "root" },
      { id: "grandchild-b", parentID: "child-b" },
    ]

    expect(sessionFamily(sessions, "great-grandchild-a")).toEqual([
      { session: sessions[1], prefix: "" },
      { session: sessions[2], prefix: "├─ " },
      { session: sessions[3], prefix: "│  └─ " },
      { session: sessions[4], prefix: "└─ " },
      { session: sessions[5], prefix: "" },
      { session: sessions[6], prefix: "└─ " },
    ])
  })

  test("orders siblings by creation time", () => {
    const sessions = [
      { id: "root", time: { created: 0 } },
      { id: "late", parentID: "root", time: { created: 2 } },
      { id: "early", parentID: "root", time: { created: 1 } },
    ]

    expect(sessionFamily(sessions, "late").map((row) => row.session.id)).toEqual(["early", "late"])
  })

  test("focuses shells only when there are no subagents", () => {
    expect(defaultComposerTab({ subagents: [], shells: ["running", "running"] })).toBe("shell")
    expect(defaultComposerTab({ subagents: ["running"], shells: ["running"] })).toBe("subagents")
    expect(defaultComposerTab({ subagents: ["running"], shells: [] })).toBe("subagents")
    expect(defaultComposerTab({ subagents: [], shells: [] })).toBe("subagents")
  })

  test("ignores finished subagents and shells", () => {
    expect(defaultComposerTab({ subagents: ["idle", "error"], shells: ["running"] })).toBe("shell")
    expect(defaultComposerTab({ subagents: [], shells: ["exited"] })).toBe("subagents")
  })
})
