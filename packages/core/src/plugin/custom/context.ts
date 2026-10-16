export * as CustomContextPlugin from "./context.js"

import { join, relative } from "path"
import { define } from "@opencode/plugin/effect/plugin"
import { CustomContext } from "@opencode/schema/custom-context"
import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { Effect, Option, Schema } from "effect"
import { SkillFile } from "../../config/plugin/skill-file.js"
import { InstructionDiscovery } from "../../instruction-discovery.js"
import { Instructions } from "../../instructions/index.js"
import { Location } from "../../location.js"
import { Project } from "../../project.js"
import { AbsolutePath } from "../../schema.js"
import { SessionMessage } from "../../session/message.js"

// Backs the TUI sidebar's context file list. Calls route to the session's Location, so
// ambient discovery is read from the same Location the session runs in.
export const Plugin = define({
  id: "custom.context",
  effect: Effect.fn("CustomContextPlugin")(function* (ctx) {
    const discovery = yield* InstructionDiscovery.Service
    const fs = yield* FSUtil.Service
    const location = yield* Location.Service
    const global = yield* Global.Service
    const config = global.config
    const configReal = yield* fs.resolve(config)

    const skillNames = Effect.fn("CustomContextPlugin.skillNames")(function* (directory: string) {
      const names = yield* Effect.forEach(RootSkillDirectories, (name) =>
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
                return parsed._tag === "Parsed" ? [parsed.skill.name] : []
              }),
            ),
          )
        }),
      )
      return [...new Set(names.flat(2))]
    })

    // A root provides its own instruction files and skills. Files the primary directory already lists,
    // and global config files, stay out of the root's group.
    const rootContext = Effect.fn("CustomContextPlugin.rootContext")(function* (
      directory: string,
      listed: ReadonlySet<string>,
    ) {
      const stop = (yield* Project.root(fs, AbsolutePath.make(directory))) ?? directory
      const walked = yield* fs
        .up({ targets: [...InstructionDiscovery.filenames], start: directory, stop, type: "file" })
        .pipe(Effect.orElseSucceed(() => [] as string[]))
      const files = (yield* Effect.forEach(walked, fs.resolve)).filter(
        (file) => !listed.has(file) && !FSUtil.contains(configReal, file),
      )
      return contextRoot(
        location.project.directory,
        directory,
        global.home,
        config,
        configReal,
        files,
        yield* skillNames(directory),
      )
    })

    yield* ctx.rpc
      .register(CustomContext.Contract, {
        list: (input) =>
          Effect.gen(function* () {
            const loaded = yield* discovery.list()
            const history = yield* ctx.session.context({ sessionID: input.sessionID })
            const session = yield* ctx.session.get({ sessionID: input.sessionID })
            const listed = new Set(Array.isArray(loaded) ? loaded.map((file) => file.path) : [])
            return {
              ...contextFiles(location.project.directory, global.home, config, configReal, loaded, history),
              skills: contextSkills(history),
              roots: yield* Effect.forEach(session.roots ?? [], (directory) => rootContext(directory, listed)),
            }
          }).pipe(Effect.orDie),
      })
      .pipe(Effect.orDie)
  }),
})

const RootSkillDirectories = [".opencode/skill", ".opencode/skills", ".claude/skills", ".agents/skills"]

const InjectedPaths = Schema.Struct({
  instruction: Schema.Struct({ paths: Schema.Array(Schema.String) }),
})

export function contextFiles(
  root: string,
  home: string,
  config: string,
  configReal: string,
  loaded: ReadonlyArray<InstructionDiscovery.File> | Instructions.Unavailable,
  history: ReadonlyArray<SessionMessage.Info>,
) {
  const nested = history.flatMap((message) => {
    if (message.type !== "synthetic") return []
    return Option.getOrUndefined(Schema.decodeUnknownOption(InjectedPaths)(message.metadata))?.instruction.paths ?? []
  })
  const ambient = Array.isArray(loaded) ? loaded.map((file) => file.path) : []
  return {
    unavailable: !Array.isArray(loaded),
    files: [...new Set([...ambient, ...nested])].map((file) => display(root, home, config, configReal, file)),
  }
}

// A root's group: its directory displayed like any other path, then its files relative to it.
export function contextRoot(
  project: string,
  directory: string,
  home: string,
  config: string,
  configReal: string,
  files: ReadonlyArray<string>,
  skills: ReadonlyArray<string>,
) {
  return {
    directory: display(project, home, config, configReal, directory),
    files: [...new Set(files)].map((file) => display(directory, home, config, configReal, file)),
    skills: [...skills],
  }
}

// History is the post-compaction window, so skills summarized away no longer count. Skills enter it as
// user-message mentions, `skill` messages, or completed `skill` tool calls.
export function contextSkills(history: ReadonlyArray<SessionMessage.Info>) {
  const names = history.flatMap((message) => {
    // Text compaction renders skills in its recent section as `[Skill activated: name]` (see messageToText).
    if (message.type === "compaction")
      return message.status === "completed"
        ? Array.from(message.recent.matchAll(/^\[Skill activated: (.+)\]$/gm), (match) => match[1])
        : []
    if (message.type === "user") return message.skills?.map((skill) => skill.name) ?? []
    if (message.type === "skill") return [message.name]
    if (message.type !== "assistant") return []
    return message.content.flatMap((part) => {
      if (part.type !== "tool" || part.name !== "skill" || part.state.status !== "completed") return []
      const name = part.state.metadata?.name
      return typeof name === "string" ? [name] : []
    })
  })
  return [...new Set(names)]
}

// Discovery stores real paths, so a config dir that is a symlink shows its target.
// Display the path the user configured instead.
function display(root: string, home: string, config: string, configReal: string, file: string) {
  if (FSUtil.contains(root, file)) return relative(root, file)
  const logical = FSUtil.contains(configReal, file) ? join(config, relative(configReal, file)) : file
  if (!FSUtil.contains(home, logical)) return logical
  const rest = relative(home, logical)
  return rest === "" ? "~" : `~/${rest}`
}
