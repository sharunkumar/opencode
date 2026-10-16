export * as SessionRoots from "./roots.js"

import type { Session } from "@opencode/schema/session"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { Context, Effect, Layer, Schema } from "effect"
import { join } from "path"
import { SkillFile } from "../config/plugin/skill-file.js"
import { InstructionDiscovery } from "../instruction-discovery.js"
import { Instructions } from "../instructions/index.js"
import { Project } from "../project.js"
import { AbsolutePath } from "../schema.js"
import { Skill } from "../skill.js"
import { SessionStore } from "./store.js"

export interface Root {
  readonly directory: AbsolutePath
  readonly files: ReadonlyArray<InstructionDiscovery.File>
  readonly skills: ReadonlyArray<Skill.Info>
}

/** Skill directories scanned inside each root. */
export const skillDirectories = [".opencode/skill", ".opencode/skills", ".claude/skills", ".agents/skills"]

export interface Interface {
  /**
   * Each Session root's own instruction files (walked up to the root's project root) and skills.
   * Files the primary Location already loads, and global config files, are omitted.
   */
  readonly discover: (session: Session.Info) => Effect.Effect<ReadonlyArray<Root>>
  /** Finds a skill by ID in the primary Location first, then in the Session's roots. */
  readonly skill: (sessionID: Session.ID, id: Skill.ID) => Effect.Effect<Skill.Info | undefined>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SessionRoots") {}

/** One instruction source for every root's files, rendered like discovered instructions. */
export function instructions(roots: ReadonlyArray<Root>): Instructions.List {
  const files = [...new Map(roots.flatMap((root) => root.files).map((file) => [file.path, file])).values()]
  return Instructions.make<ReadonlyArray<InstructionDiscovery.File>>({
    key: Instructions.Key.make("core/roots"),
    codec: Schema.toCodecJson(Schema.Array(InstructionDiscovery.File)),
    read: Effect.succeed(files.length === 0 ? Instructions.removed : files),
    render: {
      initial: InstructionDiscovery.render,
      changed: InstructionDiscovery.renderUpdate,
      removed: () => "Previously loaded session root instructions no longer apply.",
    },
  })
}

/** Primary skills plus root skills; the primary Location wins an ID collision, then earlier roots. */
export function skills(primary: ReadonlyArray<Skill.Info>, roots: ReadonlyArray<Root>) {
  return firstByID([...primary, ...roots.flatMap((root) => root.skills)])
}

function firstByID(list: ReadonlyArray<Skill.Info>) {
  return list.filter((skill, index) => list.findIndex((other) => other.id === skill.id) === index)
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const global = yield* Global.Service
    const discovery = yield* InstructionDiscovery.Service
    const primary = yield* Skill.Service
    const store = yield* SessionStore.Service
    const configReal = yield* fs.resolve(global.config)

    const rootSkills = Effect.fn("SessionRoots.skills")(function* (directory: string) {
      const found = yield* Effect.forEach(skillDirectories, (name) =>
        Effect.gen(function* () {
          const cwd = join(directory, name)
          const files = yield* fs
            .scan("{*.md,**/SKILL.md}", { cwd, absolute: true, include: "file", symlink: true, dot: true })
            .pipe(Effect.orElseSucceed(() => [] as string[]))
          return yield* Effect.forEach(files.toSorted(), (filepath) =>
            fs.readFileStringSafe(filepath).pipe(
              Effect.orElseSucceed(() => undefined),
              Effect.map((content) => {
                if (!content) return []
                const parsed = SkillFile.parse(cwd, filepath, content)
                return parsed._tag === "Parsed" ? [parsed.skill] : []
              }),
            ),
          )
        }),
      )
      return firstByID(found.flat(2))
    })

    const rootFiles = Effect.fn("SessionRoots.files")(function* (directory: AbsolutePath, listed: ReadonlySet<string>) {
      const stop = (yield* Project.root(fs, directory)) ?? directory
      const walked = yield* fs
        .up({ targets: [...InstructionDiscovery.filenames], start: directory, stop, type: "file" })
        .pipe(Effect.orElseSucceed(() => [] as string[]))
      const paths = [...new Set(yield* Effect.forEach(walked, fs.resolve))].filter(
        (file) => !listed.has(file) && !FSUtil.contains(configReal, file),
      )
      const files = yield* Effect.forEach(paths, (path) =>
        fs.readFileStringSafe(path).pipe(
          Effect.orElseSucceed(() => undefined),
          Effect.map((content) => (content === undefined ? [] : [new InstructionDiscovery.File({ path, content })])),
        ),
      )
      return files.flat()
    })

    const discover = Effect.fn("SessionRoots.discover")(function* (session: Session.Info) {
      if (!session.roots?.length) return []
      const loaded = yield* discovery.list()
      const listed = new Set(Array.isArray(loaded) ? loaded.map((file) => file.path) : [])
      return yield* Effect.forEach(
        session.roots,
        (directory) =>
          Effect.all({ files: rootFiles(directory, listed), skills: rootSkills(directory) }).pipe(
            Effect.map((found) => ({ directory, ...found })),
          ),
        { concurrency: "unbounded" },
      )
    })

    return Service.of({
      discover,
      skill: Effect.fn("SessionRoots.skill")(function* (sessionID, id) {
        const found = yield* primary.get(id)
        if (found) return found
        const session = yield* store.get(sessionID)
        if (!session) return undefined
        return (yield* discover(session)).flatMap((root) => root.skills).find((skill) => skill.id === id)
      }),
    })
  }),
)

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [FSUtil.node, Global.node, InstructionDiscovery.node, Skill.node, SessionStore.node],
})
