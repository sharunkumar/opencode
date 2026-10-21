export * as CustomContextPlugin from "./context.js"

import { tmpdir } from "os"
import { join, relative } from "path"
import { define } from "@opencode/plugin/effect/plugin"
import { CustomContext } from "@opencode/schema/custom-context"
import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { Effect, Option, Schema } from "effect"
import { InstructionDiscovery } from "../../instruction-discovery.js"
import { Instructions } from "../../instructions/index.js"
import { Location } from "../../location.js"
import { SessionMessage } from "../../session/message.js"
import { SessionRecentText } from "../../session/recent-text.js"
import { SessionRoots } from "../../session/roots.js"
import { Skill } from "../../skill.js"

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
    // Discovery stores real paths, so list both spellings of each known temp directory (/var vs /private/var on macOS).
    const temps = [...new Set([tmpdir(), yield* fs.resolve(tmpdir())])]
    const roots = yield* SessionRoots.Service
    const skills = yield* Skill.Service

    yield* ctx.rpc
      .register(CustomContext.Contract, {
        list: (input) =>
          Effect.gen(function* () {
            const loaded = yield* discovery.list()
            const history = yield* ctx.session.context({ sessionID: input.sessionID })
            const session = yield* ctx.session.get({ sessionID: input.sessionID })
            const found = yield* roots.discover(session)
            const owners = skillOwners(contextSkills(history), yield* skills.list(), found)
            return {
              ...contextFiles(location.project.directory, global.home, config, configReal, loaded, history),
              skills: owners.primary,
              roots: found.map((root) =>
                contextRoot(
                  location.project.directory,
                  root.directory,
                  global.home,
                  config,
                  configReal,
                  root.files.map((file) => file.path),
                  owners.root(root.directory),
                  temps,
                ),
              ),
            }
          }).pipe(Effect.orDie),
      })
      .pipe(Effect.orDie)
  }),
})

// Loaded skills belong to the root that provides them; the primary Location wins a name collision.
export function skillOwners(
  loaded: ReadonlyArray<string>,
  primary: ReadonlyArray<Skill.Info>,
  roots: ReadonlyArray<SessionRoots.Root>,
) {
  const primaryNames = new Set<string>(primary.map((skill) => skill.name))
  const owner = (name: string) =>
    primaryNames.has(name)
      ? undefined
      : roots.find((root) => root.skills.some((skill) => skill.name === name))?.directory
  return {
    primary: loaded.filter((name) => owner(name) === undefined),
    root: (directory: string) => loaded.filter((name) => owner(name) === directory),
  }
}

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

// A root's group: its directory displayed like any other path, then its files relative to it. A root inside a
// known temp directory (and outside the project) reports `temp` with the part after that directory, so the
// sidebar can mark it instead of the label spelling out a temp path.
export function contextRoot(
  project: string,
  directory: string,
  home: string,
  config: string,
  configReal: string,
  files: ReadonlyArray<string>,
  skills: ReadonlyArray<string>,
  temps: ReadonlyArray<string> = [],
) {
  const temp = FSUtil.contains(project, directory) ? undefined : temps.find((item) => FSUtil.contains(item, directory))
  return {
    path: directory,
    directory: temp === undefined ? display(project, home, config, configReal, directory) : relative(temp, directory),
    temp: temp !== undefined,
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
        ? Array.from(SessionRecentText.kept(message).matchAll(/^\[Skill activated: (.+)\]$/gm), (match) => match[1])
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
