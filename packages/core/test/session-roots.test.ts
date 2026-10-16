import { describe, expect } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { DateTime, Effect, Layer } from "effect"
import { Money } from "@opencode/schema/money"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { CustomContextPlugin } from "@opencode/core/plugin/custom/context"
import { Location } from "@opencode/core/location"
import { Project } from "@opencode/core/project"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { SessionRoots } from "@opencode/core/session/roots"
import { SessionStore } from "@opencode/core/session/store"
import { Skill } from "@opencode/core/skill"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { tempLocationLayer } from "./fixture/location"
import { tmpdirScoped } from "./fixture/tmpdir"
import { it } from "./lib/effect"

const sessionID = Session.ID.make("ses_roots")

const info = (roots: readonly string[]) =>
  Session.Info.make({
    id: sessionID,
    projectID: Project.ID.global,
    cost: Money.USD.make(0),
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: DateTime.makeUnsafe(0), updated: DateTime.makeUnsafe(0) },
    location: { directory: AbsolutePath.make("/project") },
    roots: roots.map((root) => AbsolutePath.make(root)),
  })

const provide = (roots: readonly string[]) =>
  Effect.provide(
    AppNodeBuilder.build(LayerNode.group([SessionRoots.node, Skill.node, Location.node]), [
      Location.node.replace(tempLocationLayer),
      SessionStore.node.replace(Layer.mock(SessionStore.Service)({ get: () => Effect.succeed(info(roots)) })),
    ]),
  )

const skill = (id: string) =>
  Skill.Info.make({
    id: Skill.ID.make(id),
    name: Skill.Name.make(id),
    path: AbsolutePath.make(`/skills/${id}/SKILL.md`),
    content: id,
  })

// A repository with an instruction file above it (excluded) and one root inside it.
const fixture = Effect.gen(function* () {
  const tmp = yield* tmpdirScoped()
  const base = yield* Effect.promise(() => fs.realpath(tmp.path))
  const repo = path.join(base, "repo")
  const root = path.join(repo, "pkg")
  yield* Effect.promise(async () => {
    await fs.mkdir(path.join(repo, ".git"), { recursive: true })
    await fs.mkdir(path.join(root, ".claude/skills/review"), { recursive: true })
    await fs.writeFile(path.join(base, "AGENTS.md"), "outside")
    await fs.writeFile(path.join(repo, "AGENTS.md"), "repo rules")
    await fs.writeFile(path.join(root, "AGENTS.md"), "pkg rules")
    await fs.writeFile(
      path.join(root, ".claude/skills/review/SKILL.md"),
      "---\nname: review\ndescription: Review code\n---\nReview carefully.",
    )
  })
  return { repo, root }
})

describe("SessionRoots", () => {
  it.live("discovers a root's instructions up to its project root and its skills", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const { repo, root } = yield* fixture
        yield* Effect.gen(function* () {
          const roots = yield* SessionRoots.Service
          const [found] = yield* roots.discover(info([root]))
          expect(found?.files.map((file) => [file.path, file.content])).toEqual([
            [path.join(root, "AGENTS.md"), "pkg rules"],
            [path.join(repo, "AGENTS.md"), "repo rules"],
          ])
          expect(found?.skills.map((skill) => [skill.id, skill.description])).toEqual([["review", "Review code"]])
          expect((yield* roots.skill(sessionID, Skill.ID.make("review")))?.content).toBe("Review carefully.")
          expect(yield* roots.skill(sessionID, Skill.ID.make("missing"))).toBeUndefined()
          expect(yield* roots.discover(info([]))).toEqual([])
        }).pipe(provide([root]))
      }),
    ),
  )

  it.effect("renders root instructions as one source and lets primary skills win a collision", () =>
    Effect.gen(function* () {
      const root = {
        directory: AbsolutePath.make("/root"),
        files: [{ path: "/root/AGENTS.md", content: "rules" }],
        skills: [skill("review"), skill("deploy")],
      }
      const [source] = SessionRoots.instructions([root, root])
      expect(String(source?.key)).toBe("core/roots")
      expect(source?.initial([{ path: "/root/AGENTS.md", content: "rules" }])).toBe(
        "Instructions from: /root/AGENTS.md\nrules",
      )
      const primary = { ...skill("review"), content: "primary" }
      expect(SessionRoots.skills([primary], [root]).map((item) => [item.id, item.content])).toEqual([
        ["review", "primary"],
        ["deploy", "deploy"],
      ])
    }),
  )

  it.effect("groups loaded skills under the root that provides them", () =>
    Effect.sync(() => {
      const roots = [
        { directory: AbsolutePath.make("/a"), files: [], skills: [skill("alpha"), skill("shared")] },
        { directory: AbsolutePath.make("/b"), files: [], skills: [skill("beta")] },
      ]
      const owners = CustomContextPlugin.skillOwners(["alpha", "beta", "shared", "local"], [skill("shared")], roots)
      expect(owners.primary).toEqual(["shared", "local"])
      expect(owners.root("/a")).toEqual(["alpha"])
      expect(owners.root("/b")).toEqual(["beta"])
    }),
  )
})
