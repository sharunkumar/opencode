import { describe, expect } from "bun:test"
import path from "path"
import { Agent } from "@opencode/core/agent"
import { Location } from "@opencode/core/location"
import { Plugin } from "@opencode/core/plugin"
import { CustomCancelHintsPlugin } from "@opencode/core/plugin/custom/cancel-hints"
import { CustomDisableSessionMovePlugin } from "@opencode/core/plugin/custom/disable-session-move"
import { CustomSessionRootsPlugin } from "@opencode/core/plugin/custom/session-roots"
import { PluginHooks } from "@opencode/core/plugin/hooks"
import { PluginHost } from "@opencode/core/plugin/host"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { Tool } from "@opencode/core/tool"
import { OpenCodeTools } from "@opencode/core/tool/plugin/opencode"
import { ShellTool } from "@opencode/core/tool/plugin/shell"
import type { SessionHooks } from "@opencode/plugin/effect/session"
import { Model } from "@opencode/schema/model"
import { Provider } from "@opencode/schema/provider"
import { SessionMessage } from "@opencode/schema/session-message"
import { Tool as ToolSchema } from "@opencode/schema/tool"
import { Effect, Schema } from "effect"
import { tmpdirScoped } from "../fixture/tmpdir"
import { testEffect } from "../lib/effect"
import { executeTool, toolIdentity } from "../lib/tool"
import { PluginTestLayer } from "./fixture"

const it = testEffect(PluginTestLayer)

const host = Effect.gen(function* () {
  return yield* PluginHost.make(yield* Plugin.Service, "test")
})

const context = (sessionID: Session.ID): SessionHooks["context"] => ({
  sessionID,
  agent: Agent.ID.make("build"),
  model: Model.Ref.make({ providerID: Provider.ID.make("test"), id: Model.ID.make("model") }),
  system: [],
  messages: [],
  tools: {},
  options: {},
})

const names = Effect.gen(function* () {
  const registry = yield* Tool.Service
  return (yield* registry.list()).map((tool) => tool.name)
})

describe("custom.tool.session-move.disable", () => {
  it.effect("removes the session move tool and its system hint", () =>
    Effect.gen(function* () {
      const hooks = yield* PluginHooks.Service
      const plugins = yield* host
      yield* OpenCodeTools.Plugin.effect(plugins)
      expect(yield* names).toContain("session_move")
      const before = context(Session.ID.make("ses_missing"))
      yield* hooks.trigger("session", "context", before)
      expect(before.system.some((part) => part.text.includes("tools.opencode.session_move"))).toBe(true)

      yield* CustomDisableSessionMovePlugin.Plugin.effect(plugins)
      expect(yield* names).not.toContain("session_move")
      const after = context(Session.ID.make("ses_missing"))
      yield* hooks.trigger("session", "context", after)
      expect(after.system.some((part) => part.text.includes("tools.opencode.session_move"))).toBe(false)
    }),
  )
})

describe("custom.session.roots", () => {
  it.live("adds the root tools to the opencode namespace and lists roots in the system prompt", () =>
    Effect.gen(function* () {
      const hooks = yield* PluginHooks.Service
      const sessions = yield* Session.Service
      const location = yield* Location.Service
      const registry = yield* Tool.Service
      const root = yield* tmpdirScoped()
      const plugins = yield* host
      yield* OpenCodeTools.Plugin.effect(plugins)
      yield* CustomSessionRootsPlugin.Plugin.effect(plugins)
      const session = yield* sessions.create({ location: Location.Ref.make({ directory: location.directory }) })
      const call = (name: string, directory: string) =>
        executeTool(registry, {
          sessionID: session.id,
          ...toolIdentity,
          call: {
            type: "tool-call",
            id: `call-${name}`,
            name: "execute",
            input: { code: `return await tools.opencode.${name}(${JSON.stringify({ directory })})` },
          },
        })

      const empty = context(session.id)
      yield* hooks.trigger("session", "context", empty)
      expect(empty.system.map((part) => part.text)).toContain(CustomSessionRootsPlugin.worktreeHint)
      expect(empty.system.some((part) => part.text.includes("additional root directories"))).toBe(false)

      yield* call("session_root_add", root.path)
      expect((yield* sessions.get(session.id)).roots).toEqual([AbsolutePath.make(root.path)])
      const listed = context(session.id)
      yield* hooks.trigger("session", "context", listed)
      expect(listed.system.at(-1)?.text).toContain(`- ${root.path}`)

      yield* call("session_root_remove", path.relative(location.directory, root.path))
      expect((yield* sessions.get(session.id)).roots).toBeUndefined()
    }),
  )
})

describe("custom.tool.cancel-hints", () => {
  const background = (shellID: string): PluginHooks.Domains["tool"]["execute.after"] => ({
    tool: ShellTool.name,
    sessionID: Session.ID.make("ses_cancel_hints"),
    agent: Agent.ID.make("build"),
    messageID: SessionMessage.ID.make("msg_cancel_hints"),
    id: ToolSchema.CallID.make("call_cancel_hints"),
    input: { command: "sleep 60", background: true },
    status: "completed",
    result: {
      content: [
        {
          type: "text",
          text: `Command moved to the background (shell ID: ${shellID}).\nOutput is streaming to: /tmp/x`,
        },
        { type: "text", text: "You will be notified automatically when the command finishes." },
      ],
      metadata: { status: "running", shellID },
    },
  })

  it.effect("keeps upstream's shell texts that the plugin rewrites", () =>
    Effect.promise(async () => {
      const source = await Bun.file(path.join(import.meta.dir, "../../src/tool/plugin/shell.ts")).text()
      expect(source).toContain(CustomCancelHintsPlugin.backgroundSentence)
      expect(source).toContain("Command moved to the background (shell ID: ${info.id})")
    }),
  )

  it.effect("tells the model to cancel background shells with the cancel tool", () =>
    Effect.gen(function* () {
      const hooks = yield* PluginHooks.Service
      const registry = yield* Tool.Service
      const plugins = yield* host
      yield* plugins.tool.transform((editor) =>
        editor.add({
          name: ShellTool.name,
          description: `Run a command. ${CustomCancelHintsPlugin.backgroundSentence}`,
          input: Schema.Struct({}),
          execute: () => Effect.succeed({ content: "ok" }),
        }),
      )
      yield* CustomCancelHintsPlugin.Plugin.effect(plugins)
      const shell = (yield* registry.list()).find((tool) => tool.name === ShellTool.name)
      expect(shell?.description).toBe(`Run a command. ${CustomCancelHintsPlugin.cancelSentence}`)

      const event = background("sh_1")
      yield* hooks.trigger("tool", "execute.after", event)
      if (event.status !== "completed") throw new Error("expected a completed event")
      expect(event.result.content).toEqual([
        {
          type: "text",
          text: `Command moved to the background (shell ID: sh_1).\nOutput is streaming to: /tmp/x\n${CustomCancelHintsPlugin.cancelHint("sh_1")}`,
        },
        { type: "text", text: "You will be notified automatically when the command finishes." },
      ])

      const finished = background("sh_2")
      if (finished.status !== "completed") throw new Error("expected a completed event")
      finished.result = { ...finished.result, metadata: { status: "exited", shellID: "sh_2" } }
      const content = finished.result.content
      yield* hooks.trigger("tool", "execute.after", finished)
      expect(finished.result.content).toEqual(content)
    }),
  )
})
