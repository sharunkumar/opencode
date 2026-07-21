import path from "path"
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { AgentV2 } from "@opencode-ai/core/agent"
import { Config } from "@opencode-ai/core/config"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { SkillV2 } from "@opencode-ai/core/skill"
import { SkillAutoload } from "@opencode-ai/core/skill/autoload"
import { SystemContext } from "@opencode-ai/core/system-context"
import { it } from "../lib/effect"

const build = AgentV2.ID.make("build")
const effect = SkillV2.Info.make({
  name: "effect",
  description: "Build applications with Effect",
  location: AbsolutePath.make(path.resolve("/skills/effect/SKILL.md")),
  content: "Effect guidance body",
})

const layer = (autoLoad: string[] = ["effect"]) =>
  AppNodeBuilder.build(SkillAutoload.node, [
    [SkillV2.node, Layer.mock(SkillV2.Service, { list: () => Effect.succeed([effect]) })],
    [
      Config.node,
      Layer.mock(Config.Service, {
        entries: () =>
          Effect.succeed([
            new Config.Document({
              type: "document",
              path: "/tmp/opencode.json",
              info: new Config.Info({ auto_load_skills: autoLoad }),
            }),
          ]),
      }),
    ],
  ])

describe("SkillAutoload", () => {
  it.effect("injects configured skill content for main sessions", () => {
    const agent = AgentV2.Info.empty(build)
    return Effect.gen(function* () {
      const autoload = yield* SkillAutoload.Service
      const initialized = yield* autoload
        .load({ id: agent.id, info: agent }, {})
        .pipe(Effect.flatMap(SystemContext.initialize))
      expect(initialized.baseline).toContain("loaded automatically")
      expect(initialized.baseline).toContain('<skill_content name="effect">')
      expect(initialized.baseline).toContain("Effect guidance body")
    }).pipe(Effect.provide(layer()))
  })

  it.effect("skips auto-load for subagent child sessions", () => {
    const agent = AgentV2.Info.empty(build)
    return Effect.gen(function* () {
      const autoload = yield* SkillAutoload.Service
      expect(
        yield* autoload
          .load({ id: agent.id, info: agent }, { parentID: SessionSchema.ID.make("ses_child") })
          .pipe(Effect.flatMap(SystemContext.initialize)),
      ).toEqual({
        baseline: "",
        snapshot: {},
      })
    }).pipe(Effect.provide(layer()))
  })

  it.effect("skips missing skill names without failing", () => {
    const agent = AgentV2.Info.empty(build)
    return Effect.gen(function* () {
      const autoload = yield* SkillAutoload.Service
      const initialized = yield* autoload
        .load({ id: agent.id, info: agent }, {})
        .pipe(Effect.flatMap(SystemContext.initialize))
      expect(initialized.baseline).toBe("")
      expect(initialized.snapshot).toEqual({})
    }).pipe(Effect.provide(layer(["missing-skill"])))
  })
})
