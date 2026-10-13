export * as CustomContextPlugin from "./context.js"

import { relative } from "path"
import { define } from "@opencode/plugin/effect/plugin"
import { CustomContext } from "@opencode/schema/custom-context"
import { FSUtil } from "@opencode/util/fs-util"
import { Effect, Option, Schema } from "effect"
import { InstructionDiscovery } from "../../instruction-discovery.js"
import { Instructions } from "../../instructions/index.js"
import { Location } from "../../location.js"
import { SessionMessage } from "../../session/message.js"

// Backs the TUI sidebar's context file list. Calls route to the session's Location, so
// ambient discovery is read from the same Location the session runs in.
export const Plugin = define({
  id: "custom.context",
  effect: Effect.fn("CustomContextPlugin")(function* (ctx) {
    const discovery = yield* InstructionDiscovery.Service
    const location = yield* Location.Service

    yield* ctx.rpc
      .register(CustomContext.Contract, {
        list: (input) =>
          Effect.gen(function* () {
            const loaded = yield* discovery.list()
            const history = yield* ctx.session.context({ sessionID: input.sessionID })
            return contextFiles(location.project.directory, loaded, history)
          }).pipe(Effect.orDie),
      })
      .pipe(Effect.orDie)
  }),
})

const InjectedPaths = Schema.Struct({
  instruction: Schema.Struct({ paths: Schema.Array(Schema.String) }),
})

export function contextFiles(
  root: string,
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
    files: [...new Set([...ambient, ...nested])].map((file) => (FSUtil.contains(root, file) ? relative(root, file) : file)),
  }
}
