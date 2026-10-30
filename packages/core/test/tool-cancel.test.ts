import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Job } from "@opencode/core/job"
import { Permission } from "@opencode/core/permission"
import { Database } from "@opencode/core/database/database"
import { Session } from "@opencode/core/session"
import { SessionSchema } from "@opencode/core/session/schema"
import { Tool } from "@opencode/core/tool"
import { CancelTool } from "@opencode/core/tool/plugin/cancel"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Global } from "@opencode/util/global"
import { testEffect } from "./lib/effect"
import { permissionLayer } from "./lib/permission"
import { executeTool, registerToolPlugin, toolIdentity } from "./lib/tool"

const sessionID = SessionSchema.ID.make("ses_cancel_tool")
const interrupted: SessionSchema.ID[] = []
const unused = () => Effect.die("unused")
const session = Layer.mock(Session.Service, {
  interrupt: (id: SessionSchema.ID) =>
    Effect.sync(() => {
      interrupted.push(id)
      return true
    }),
  revert: { stage: unused, clear: unused, commit: unused },
})
const cancelToolNode = makeLocationNode({
  name: "test/cancel-tool-plugin",
  layer: Layer.effectDiscard(registerToolPlugin(CancelTool.Plugin)),
  deps: [Tool.node, Job.node, Session.node],
})

const it = testEffect(
  AppNodeBuilder.build(LayerNode.group([Tool.node, Job.node, Database.node, Global.node, cancelToolNode]), [
    Session.node.replace(session),
    Permission.node.replace(permissionLayer()),
  ]),
)

const call = (id: string, target = sessionID) =>
  Effect.gen(function* () {
    const registry = yield* Tool.Service
    return yield* executeTool(registry, {
      sessionID: target,
      ...toolIdentity,
      call: { type: "tool-call", id: `call-${id}`, name: CancelTool.name, input: { id } },
    })
  })

describe("CancelTool", () => {
  it.live("cancels a background shell owned by this session", () =>
    Effect.gen(function* () {
      const jobs = yield* Job.Service
      yield* jobs.start({
        id: "shell_cancel",
        type: "shell",
        metadata: { sessionID },
        run: Effect.never,
      })

      expect(yield* call("shell_cancel")).toMatchObject({
        status: "completed",
        output: { id: "shell_cancel", status: "cancelled" },
      })
      expect(yield* jobs.get("shell_cancel")).toMatchObject({ status: "cancelled" })
    }),
  )

  it.live("interrupts a background subagent and cancels its job", () =>
    Effect.gen(function* () {
      interrupted.length = 0
      const jobs = yield* Job.Service
      const child = SessionSchema.ID.make("ses_cancel_child")
      yield* jobs.start({
        id: child,
        type: "subagent",
        metadata: { sessionID },
        run: Effect.never,
      })

      expect(yield* call(child)).toMatchObject({
        status: "completed",
        output: { id: child, status: "cancelled" },
      })
      expect(interrupted).toEqual([child])
    }),
  )

  it.live("refuses a background job owned by another session", () =>
    Effect.gen(function* () {
      const jobs = yield* Job.Service
      yield* jobs.start({
        id: "shell_other",
        type: "shell",
        metadata: { sessionID: SessionSchema.ID.make("ses_other") },
        run: Effect.never,
      })

      expect(yield* call("shell_other")).toMatchObject({ status: "error" })
      expect(yield* jobs.get("shell_other")).toMatchObject({ status: "running" })
      yield* jobs.cancel("shell_other")
    }),
  )
})
