export * as CustomSessionRootsPlugin from "./session-roots.js"

import { SystemPart } from "@opencode/ai/effect"
import { define } from "@opencode/plugin/effect/plugin"
import { AbsolutePath } from "@opencode/schema/schema"
import { Session } from "@opencode/schema/session"
import { Effect, Option, Schema } from "effect"
import { toolFailure } from "../../tool/runtime.js"

export const RootInput = Schema.Struct({
  sessionID: Schema.optionalKey(Session.ID).annotate({ description: "Omit to target the current session." }),
  directory: Schema.String.check(Schema.isMinLength(1)).annotate({
    description: "Directory, relative to the target session's directory or absolute. Supports ~.",
  }),
})

const RootOutput = Schema.Struct({ sessionID: Session.ID, directory: AbsolutePath })

export const worktreeHint =
  "When you create a worktree outside the current working directory and intend to work in it, consider using `execute` to call `tools.opencode.session_root_add` so the worktree is in scope for this session."

export const Plugin = define({
  id: "custom.session.roots",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.tool.transform((editor) => {
      editor.add({
        name: "session_root_add",
        description:
          "Add a directory to a session's roots, or omit sessionID to target the current session. Roots are readable and editable without external-directory approval. The working directory does not change.",
        input: RootInput,
        output: RootOutput,
        options: { namespace: "opencode", codemode: true, pinned: true },
        execute: (input, context) => {
          const sessionID = input.sessionID ?? context.sessionID
          return ctx.session.root.add({ sessionID, directory: input.directory }).pipe(
            Effect.map((result) => ({
              output: { sessionID, directory: result.directory },
              content: `Added ${result.directory} to session ${sessionID} roots.`,
            })),
            Effect.mapError(toolFailure(`Unable to add root ${input.directory}`)),
          )
        },
      })
      editor.add({
        name: "session_root_remove",
        description: "Remove a directory from a session's roots, or omit sessionID to target the current session.",
        input: RootInput,
        output: RootOutput,
        options: { namespace: "opencode", codemode: true, pinned: true },
        execute: (input, context) => {
          const sessionID = input.sessionID ?? context.sessionID
          return ctx.session.root.remove({ sessionID, directory: input.directory }).pipe(
            Effect.map((result) => ({
              output: { sessionID, directory: result.directory },
              content: `Removed ${result.directory} from session ${sessionID} roots.`,
            })),
            Effect.mapError(toolFailure(`Unable to remove root ${input.directory}`)),
          )
        },
      })
    })
    yield* ctx.session.hook("context", (event) =>
      Effect.gen(function* () {
        event.system.push(SystemPart.make(worktreeHint))
        const session = yield* ctx.session.get({ sessionID: event.sessionID }).pipe(Effect.option)
        const roots = Option.getOrUndefined(session)?.roots
        if (!roots?.length) return
        event.system.push(
          SystemPart.make(
            [
              "This session has additional root directories. They are in scope like the working directory, but commands still run in the working directory unless you set one.",
              ...roots.map((root) => `- ${root}`),
            ].join("\n"),
          ),
        )
      }),
    )
  }),
})
