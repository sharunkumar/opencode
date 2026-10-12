import { expect } from "bun:test"
import { Agent } from "@opencode/core/agent"
import { Plugin } from "@opencode/core/plugin"
import { CustomAutoLoadSkillsPlugin } from "@opencode/core/plugin/custom/auto-load-skills"
import { CustomTaskResumePlugin } from "@opencode/core/plugin/custom/task-resume"
import { CustomTimeoutsPlugin } from "@opencode/core/plugin/custom/timeouts"
import { PluginHooks } from "@opencode/core/plugin/hooks"
import { PluginHost } from "@opencode/core/plugin/host"
import { Session } from "@opencode/core/session"
import { Tool } from "@opencode/schema/tool"
import { SessionMessage } from "@opencode/schema/session-message"
import { Effect } from "effect"
import { testEffect } from "../lib/effect"
import { PluginTestLayer } from "./fixture"

const it = testEffect(PluginTestLayer)

const before = (tool: string, sessionID: Session.ID, input: unknown) => ({
  tool,
  sessionID,
  agent: Agent.ID.make("build"),
  messageID: SessionMessage.ID.make("msg_custom"),
  id: Tool.CallID.make("call_custom"),
  input,
})

it.effect("drops a subagent sessionID that is not a child session", () =>
  Effect.gen(function* () {
    const hooks = yield* PluginHooks.Service
    const host = yield* PluginHost.make(yield* Plugin.Service)
    yield* CustomTaskResumePlugin.Plugin.effect(host)
    const sessionID = Session.ID.make("ses_custom_parent")
    const invalid = before("subagent", sessionID, { agent: "explore", sessionID: "not-a-session" })
    yield* hooks.trigger("tool", "execute.before", invalid)
    expect(invalid.input).toEqual({ agent: "explore" })
    const missing = before("subagent", sessionID, { agent: "explore", sessionID: "ses_custom_missing" })
    yield* hooks.trigger("tool", "execute.before", missing)
    expect(missing.input).toEqual({ agent: "explore" })
    const other = before("shell", sessionID, { sessionID: "not-a-session" })
    yield* hooks.trigger("tool", "execute.before", other)
    expect(other.input).toEqual({ sessionID: "not-a-session" })
  }),
)

it.effect("disables the default shell timeout until a session opts in", () =>
  Effect.gen(function* () {
    const hooks = yield* PluginHooks.Service
    const host = yield* PluginHost.make(yield* Plugin.Service)
    yield* CustomTimeoutsPlugin.Plugin.effect(host)
    const sessionID = Session.ID.make("ses_custom_timeouts")
    const off = before("shell", sessionID, { command: "sleep 1" })
    yield* hooks.trigger("tool", "execute.before", off)
    expect(off.input).toEqual({ command: "sleep 1", timeout: 0 })
    const explicit = before("shell", sessionID, { command: "sleep 1", timeout: 5000 })
    yield* hooks.trigger("tool", "execute.before", explicit)
    expect(explicit.input).toEqual({ command: "sleep 1", timeout: 5000 })
    const background = before("shell", sessionID, { command: "sleep 1", background: true })
    yield* hooks.trigger("tool", "execute.before", background)
    expect(background.input).toEqual({ command: "sleep 1", background: true })
  }),
)

it.effect("parses the auto-load skill list", () =>
  Effect.sync(() => {
    expect(CustomAutoLoadSkillsPlugin.parse(" Foo, bar ,,")).toEqual(["foo", "bar"])
    expect(CustomAutoLoadSkillsPlugin.parse(undefined)).toEqual([])
  }),
)
