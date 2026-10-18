import { expect } from "bun:test"
import { Agent } from "@opencode/core/agent"
import { Model } from "@opencode/schema/model"
import { Provider } from "@opencode/schema/provider"
import { Plugin } from "@opencode/core/plugin"
import { InstructionDiscovery } from "@opencode/core/instruction-discovery"
import { Instructions } from "@opencode/core/instructions/index"
import { CustomAutoLoadSkillsPlugin } from "@opencode/core/plugin/custom/auto-load-skills"
import { CustomContextPlugin } from "@opencode/core/plugin/custom/context"
import { CustomPullRequestsPlugin } from "@opencode/core/plugin/custom/pull-requests"
import { CustomTaskResumePlugin } from "@opencode/core/plugin/custom/task-resume"
import { CustomTimeoutsPlugin } from "@opencode/core/plugin/custom/timeouts"
import { PluginHooks } from "@opencode/core/plugin/hooks"
import { PluginHost } from "@opencode/core/plugin/host"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { Skill } from "@opencode/schema/skill"
import { Tool } from "@opencode/schema/tool"
import { SessionMessage } from "@opencode/schema/session-message"
import { DateTime, Effect } from "effect"
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

it.effect("collects context files without duplicates and flags unavailable discovery", () =>
  Effect.sync(() => {
    const project = AbsolutePath.make("/repo")
    const history = [
      SessionMessage.Synthetic.make({
        id: SessionMessage.ID.make("msg_nested"),
        type: "synthetic",
        text: "nested",
        metadata: { instruction: { paths: [`${project}/AGENTS.md`, `${project}/packages/web/AGENTS.md`] } },
        time: { created: DateTime.makeUnsafe(0) },
      }),
    ]
    const ambient = [
      new InstructionDiscovery.File({ path: AbsolutePath.make(`${project}/AGENTS.md`), content: "root" }),
    ]
    const home = "/home/user"
    const config = `${home}/.config/opencode`
    expect(CustomContextPlugin.contextFiles(project, home, config, config, ambient, history)).toEqual({
      unavailable: false,
      files: ["AGENTS.md", "packages/web/AGENTS.md"],
    })
    expect(CustomContextPlugin.contextFiles(project, home, config, config, Instructions.unavailable, history)).toEqual({
      unavailable: true,
      files: ["AGENTS.md", "packages/web/AGENTS.md"],
    })
    expect(CustomContextPlugin.contextFiles(project, home, config, config, [], [])).toEqual({
      unavailable: false,
      files: [],
    })
    const linked = `${home}/dotfiles/.config/opencode`
    const global = [
      new InstructionDiscovery.File({
        path: AbsolutePath.make(`${linked}/AGENTS.md`),
        content: "global",
      }),
    ]
    expect(CustomContextPlugin.contextFiles(project, home, config, linked, global, [])).toEqual({
      unavailable: false,
      files: ["~/.config/opencode/AGENTS.md"],
    })
  }),
)

it.effect("groups a root's instructions and skills under its own directory", () =>
  Effect.sync(() => {
    const home = "/home/user"
    const config = `${home}/.config/opencode`
    expect(
      CustomContextPlugin.contextRoot(
        "/repo",
        `${home}/src/cmux`,
        home,
        config,
        config,
        [
          `${home}/src/cmux/AGENTS.md`,
          `${home}/src/cmux/web/AGENTS.md`,
          `${home}/src/AGENTS.md`,
          `${home}/src/cmux/AGENTS.md`,
        ],
        ["review", "deploy"],
      ),
    ).toEqual({
      path: `${home}/src/cmux`,
      directory: "~/src/cmux",
      temp: false,
      files: ["AGENTS.md", "web/AGENTS.md", "~/src/AGENTS.md"],
      skills: ["review", "deploy"],
    })
    expect(CustomContextPlugin.contextRoot("/repo", "/opt/shared", home, config, config, [], [])).toEqual({
      path: "/opt/shared",
      directory: "/opt/shared",
      temp: false,
      files: [],
      skills: [],
    })
    expect(CustomContextPlugin.contextRoot("/repo", "/repo/packages/web", home, config, config, [], [])).toEqual({
      path: "/repo/packages/web",
      directory: "packages/web",
      temp: false,
      files: [],
      skills: [],
    })
  }),
)

it.effect("marks roots inside a known temp directory instead of spelling out the temp path", () =>
  Effect.sync(() => {
    const home = "/home/user"
    const config = `${home}/.config/opencode`
    const temps = ["/var/folders/ab/T", "/private/var/folders/ab/T"]
    const root = (directory: string, project = "/repo") =>
      CustomContextPlugin.contextRoot(project, directory, home, config, config, [], [], temps)
    expect(root("/private/var/folders/ab/T/opencode/work")).toMatchObject({
      path: "/private/var/folders/ab/T/opencode/work",
      directory: "opencode/work",
      temp: true,
    })
    expect(root("/var/folders/ab/T/opencode")).toMatchObject({ directory: "opencode", temp: true })
    expect(root("/var/folders/ab/T")).toMatchObject({ directory: "", temp: true })
    expect(root("/var/folders/ab/T-other")).toMatchObject({ directory: "/var/folders/ab/T-other", temp: false })
    expect(root("/repo/tmp")).toMatchObject({ directory: "tmp", temp: false })
    expect(root("/var/folders/ab/T/work", "/var/folders/ab/T")).toMatchObject({ directory: "work", temp: false })
  }),
)

it.effect("collects loaded skills from mentions, skill messages, and completed skill tool calls", () =>
  Effect.sync(() => {
    const time = { created: DateTime.makeUnsafe(0) }
    const tool = (id: string, status: "completed" | "error", name?: string) =>
      SessionMessage.AssistantTool.make({
        type: "tool",
        id,
        name: "skill",
        state:
          status === "completed"
            ? SessionMessage.ToolStateCompleted.make({
                status,
                input: {},
                content: [{ type: "text", text: "ok" }],
                metadata: name === undefined ? undefined : { name },
              })
            : SessionMessage.ToolStateError.make({
                status,
                input: {},
                error: { type: "tool", message: "failed" },
              }),
        time,
      })
    const history = [
      SessionMessage.User.make({
        id: SessionMessage.ID.make("msg_user"),
        type: "user",
        text: "use it",
        skills: [{ id: Skill.ID.make("alpha"), name: Skill.Name.make("alpha") }],
        time,
      }),
      SessionMessage.Skill.make({
        id: SessionMessage.ID.make("msg_skill"),
        type: "skill",
        skill: Skill.ID.make("beta"),
        name: Skill.Name.make("beta"),
        text: "beta body",
        time,
      }),
      SessionMessage.Assistant.make({
        id: SessionMessage.ID.make("msg_assistant"),
        type: "assistant",
        agent: Agent.ID.make("build"),
        model: { id: Model.ID.make("sonnet"), providerID: Provider.ID.make("anthropic") },
        content: [tool("call_1", "completed", "gamma"), tool("call_2", "error"), tool("call_3", "completed", "alpha")],
        time,
      }),
    ]
    const compacted = SessionMessage.CompactionCompleted.make({
      id: SessionMessage.ID.make("msg_compaction"),
      type: "compaction",
      status: "completed",
      reason: "auto",
      summary: "[Skill activated: ignored]",
      recent: "[Skill activated: delta]\ndelta body\n\n[User]: hi\n[Skill activated: alpha]\nalpha body",
      time,
    })
    expect(CustomContextPlugin.contextSkills(history)).toEqual(["alpha", "beta", "gamma"])
    expect(CustomContextPlugin.contextSkills([compacted, ...history])).toEqual(["delta", "alpha", "beta", "gamma"])
    expect(CustomContextPlugin.contextSkills([])).toEqual([])
  }),
)

it.effect("normalizes pull request hosts and always includes github.com", () =>
  Effect.sync(() => {
    expect(CustomPullRequestsPlugin.hostList(undefined)).toEqual(["github.com"])
    expect(
      CustomPullRequestsPlugin.hostList({ hosts: ["https://GHE.example.com/", " ghe.example.com ", "github.com", ""] }),
    ).toEqual(["github.com", "ghe.example.com"])
    expect(CustomPullRequestsPlugin.hostList({ hosts: "nope" })).toEqual(["github.com"])
  }),
)

it.effect("collects pull request links from the transcript without duplicates", () =>
  Effect.sync(() => {
    const user = (text: string, id: string) =>
      SessionMessage.User.make({
        id: SessionMessage.ID.make(id),
        type: "user",
        text,
        files: [],
        agents: [],
        time: { created: DateTime.makeUnsafe(0) },
      })
    const history = [
      user("see https://github.com/acme/app/pull/12 and https://GHE.example.com/team/svc/pull/7/files", "msg_a"),
      user("again https://github.com/acme/app/pull/12, plus https://other.example.com/x/y/pull/1", "msg_b"),
      user("an issue https://github.com/acme/app/issues/3", "msg_c"),
      SessionMessage.Synthetic.make({
        id: SessionMessage.ID.make("msg_hidden"),
        type: "synthetic",
        text: "https://github.com/acme/hidden/pull/9",
        time: { created: DateTime.makeUnsafe(0) },
      }),
      SessionMessage.Assistant.make({
        id: SessionMessage.ID.make("msg_reply"),
        type: "assistant",
        agent: Agent.ID.make("build"),
        model: { id: Model.ID.make("model"), providerID: Provider.ID.make("provider") },
        content: [
          SessionMessage.AssistantReasoning.make({
            type: "reasoning",
            text: "https://github.com/acme/thought/pull/4",
          }),
          SessionMessage.AssistantText.make({
            type: "text",
            text: "opened https://github.com/acme/reply/pull/5",
          }),
          SessionMessage.AssistantTool.make({
            type: "tool",
            id: "call",
            name: "read",
            state: { status: "streaming", input: "https://github.com/acme/tool/pull/6" },
            time: { created: DateTime.makeUnsafe(0) },
          }),
        ],
        time: { created: DateTime.makeUnsafe(0) },
      }),
    ]
    expect(CustomPullRequestsPlugin.pullRequests(["github.com", "ghe.example.com"], history)).toEqual([
      { url: "https://github.com/acme/app/pull/12", label: "acme/app#12" },
      { url: "https://ghe.example.com/team/svc/pull/7", label: "team/svc#7" },
      { url: "https://github.com/acme/reply/pull/5", label: "acme/reply#5" },
    ])
    expect(CustomPullRequestsPlugin.pullRequests(["github.com"], history).map((pr) => pr.label)).toEqual([
      "acme/app#12",
      "acme/reply#5",
    ])
  }),
)

it.effect("reads the auto-load skill list from plugin options", () =>
  Effect.sync(() => {
    expect(CustomAutoLoadSkillsPlugin.names({ skills: [" Foo ", "bar", ""] })).toEqual(["foo", "bar"])
    expect(CustomAutoLoadSkillsPlugin.names({ skills: [] })).toEqual([])
    expect(CustomAutoLoadSkillsPlugin.names({})).toEqual([])
    expect(CustomAutoLoadSkillsPlugin.names({ skills: "nope" })).toEqual([])
  }),
)
