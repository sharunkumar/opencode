export * as CancelTool from "./cancel.js"

import { ToolFailure } from "@opencode/ai"
import type { Context } from "@opencode/plugin/effect/plugin"
import { Effect, Schema } from "effect"
import { Job } from "../../job.js"
import { Session } from "../../session.js"
import { SessionSchema } from "../../session/schema.js"

export const name = "cancel"

export const Input = Schema.Struct({
  id: Schema.String.check(Schema.isMinLength(1)).annotate({
    description:
      "shell ID or subagent sessionID returned when a shell or subagent was started with background set to true.",
  }),
})

const Output = Schema.Struct({
  id: Schema.String,
  status: Schema.Literals(["completed", "error", "cancelled"]),
})

export const description = [
  "Cancel a background shell or subagent that you started.",
  "Pass the shell ID or subagent sessionID from the background result.",
  "Already finished jobs are left as they are.",
].join("\n")

const failure = (message: string, error?: unknown) => new ToolFailure({ message, error })

export const Plugin = {
  id: "opencode.tool.cancel",
  effect: Effect.fn("CancelTool.Plugin")(function* (ctx: Context) {
    const jobs = yield* Job.Service
    const sessions = yield* Session.Service
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name,
          options: { codemode: false },
          description,
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              const info = yield* jobs.get(input.id)
              if (!info || (info.type !== "shell" && info.type !== "subagent"))
                return yield* failure(`No background shell or subagent with id ${input.id}`)
              const owner = info.metadata?.sessionID
              if (typeof owner === "string" && owner !== context.sessionID)
                return yield* failure(`Background job ${input.id} belongs to another session`)
              if (info.status !== "running")
                return {
                  output: { id: info.id, status: info.status },
                  content: `Background job ${info.id} is already ${info.status}.`,
                }
              if (info.type === "subagent") yield* sessions.interrupt(SessionSchema.ID.make(info.id))
              yield* jobs.cancel(info.id)
              return {
                output: { id: info.id, status: "cancelled" as const },
                content: `Cancelled background job ${info.id}.`,
              }
            }).pipe(Effect.mapError((error) => failure(`Unable to cancel background job ${input.id}`, error))),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
