export * as SkillAutoload from "./autoload"

import path from "path"
import { makeLocationNode } from "../effect/app-node"
import { Context, Effect, Layer, Schema } from "effect"
import { AgentV2 } from "../agent"
import { Config } from "../config"
import { FSUtil } from "../fs-util"
import { PermissionV2 } from "../permission"
import { SessionSchema } from "../session/schema"
import { SkillV2 } from "../skill"
import { SkillTool } from "../tool/skill"
import { SystemContext } from "../system-context/index"

const Loaded = Schema.Struct({
  name: Schema.String,
  output: Schema.String,
})
type Loaded = typeof Loaded.Type

const FILE_LIMIT = 10

const render = (skills: ReadonlyArray<Loaded>) =>
  [
    "The following skills were loaded automatically for this session. Their instructions already apply; do not call the skill tool for them.",
    ...skills.map((skill) => skill.output),
  ].join("\n\n")

export interface Interface {
  readonly load: (
    agent: AgentV2.Selection,
    session: { readonly parentID?: SessionSchema.ID },
  ) => Effect.Effect<SystemContext.SystemContext>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/SkillAutoload") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const skills = yield* SkillV2.Service
    const config = yield* Config.Service
    const fs = yield* FSUtil.Service

    return Service.of({
      load: Effect.fn("SkillAutoload.load")(function* (selection, session) {
        if (session.parentID) return SystemContext.empty
        const agent = selection.info
        if (!agent) return SystemContext.empty

        return yield* Effect.gen(function* () {
          const names = Config.latest(yield* config.entries(), "auto_load_skills") ?? []
          if (names.length === 0) return SystemContext.empty

          const all = yield* skills.list()
          const byName = new Map(all.map((skill) => [skill.name, skill]))
          const loaded = yield* Effect.forEach(
            names,
            (name) =>
              Effect.gen(function* () {
                if (PermissionV2.evaluate("skill", name, agent.permissions).effect === "deny") return
                const skill = byName.get(name)
                if (!skill) return
                const directory = path.dirname(skill.location)
                const files =
                  path.basename(skill.location) === "SKILL.md"
                    ? (yield* fs
                        .glob("**/*", { cwd: directory, absolute: true, include: "file", dot: true })
                        .pipe(Effect.catch(() => Effect.succeed([] as string[]))))
                        .filter((file) => path.basename(file) !== "SKILL.md")
                        .toSorted()
                        .slice(0, FILE_LIMIT)
                    : []
                return { name: skill.name, output: SkillTool.toModelOutput(skill, files) }
              }).pipe(Effect.catch(() => Effect.succeed(undefined))),
            { concurrency: "unbounded" },
          )
          const current = loaded.filter((item): item is Loaded => item !== undefined)
          if (current.length === 0) return SystemContext.empty

          return SystemContext.make({
            key: SystemContext.Key.make("core/skill-autoload"),
            codec: Schema.toCodecJson(Schema.Array(Loaded)),
            load: Effect.succeed(current),
            baseline: render,
            update: (_previous, next) =>
              [
                "The automatically loaded skills have changed. This list supersedes the previous auto-loaded skills.",
                render(next),
              ].join("\n"),
            removed: () => "Previously auto-loaded skills no longer apply.",
          })
        }).pipe(Effect.catch(() => Effect.succeed(SystemContext.empty)))
      }),
    })
  }),
)

export const locationLayer = layer

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [SkillV2.node, Config.node, FSUtil.node],
})
