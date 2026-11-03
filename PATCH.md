# Fork Additions

## Skill Auto-Load

The plugin `custom.skills.auto-load` adds named skills to the system prompts of main sessions. It removes those skills from `available_skills`. Configure it with `{ "plugins": [{ "package": "custom.skills.auto-load", "options": { "skills": ["a", "b"] } }] }`.

## Builtin Plugin Options

A `plugins` config entry enables a builtin plugin when its `package` is the plugin id. The entry passes `options` to the plugin. Wildcard entries (`custom.*`) pass no options.

## Disabled Workflows

Only `ci` runs on this fork. After you merge upstream, run `make disable-workflows`. It disables all other workflows.

## Removed Upstream Custom Tools

The fork removed `.opencode/tool/github-pr-search.ts` and `github-triage.ts`. These tools use the v1 style (`import { tool } from "@opencode/plugin"`). They fail to load on v2 and break every prompt run in this repo.

## Fork CI Workflow

`ci.yml` is the only workflow of the fork. It checks pull requests and pushes to `dev`. On a push to `dev`, it builds the CLI and publishes a datever GitHub Release.

## Makefile

- `make build-single` builds the single-file `opencode` binary.
- `make generate` regenerates the protocol, the client, and the docs.
- `make tests` runs the tests of the fork.
- `make git-setup` registers the merge drivers (see Migration Merge Drivers).

## Migration Merge Drivers

The merge drivers in `packages/core/script/merge-driver.ts` resolve `migration.gen.ts` and `schema.json`. They apply when upstream adds a migration next to the migration of the fork. Run `make git-setup` one time in each clone.

## Interrupt-and-Submit Keybind (`prompt_interrupt_submit`)

`ctrl+return` (`prompt_interrupt_submit`) stops the active run and submits the prompt as a new run. It needs the kitty keyboard protocol. It no longer inserts a newline.

## Click-to-Toggle MCPs in TUI Sidebar

Click an MCP in the sidebar to enable or disable it. A connection in progress has the status `pending` (upstream renamed `connecting` to `pending`). The web UI still shows "connecting". V1 servers that send `connecting` become `pending` when the config loads.

## Prompt Stash Defaults

`ctrl+s` stashes the current prompt. `ctrl+shift+s` restores the last stashed prompt.

## Terminal Title Without `OC |` Prefix

Terminal titles of sessions and plugins show the plain title or id. They have no `OC |` prefix.

## Bash Tool Syntax Highlighting (TUI)

The TUI highlights commands of the bash and shell tools with tree-sitter bash. The `$ ` marker renders separately, so the shell grammar sees only the command.

## Provider Colorization (TUI)

Each provider has a stable theme color in the model picker and in the prompt footer.

## Model Keyword Highlights (TUI)

The `cli.json` setting `model_keywords` holds case-insensitive regexes. The TUI colors the matching text in model names in the model picker and in the prompt footer.

## Free Badge for Zero-Cost Models (TUI)

The model picker shows a `Free` footer for each model with `cost.input === 0`. This applies to all providers, not only `opencode`.

## Agent Cycle Tab Strip (TUI)

Tab selects the next agent. Shift+Tab selects the previous agent. A colored list of agents shows for a short time. Click an agent in the list to select it.

## `/timeouts` Command

The plugins `custom.shell.timeouts` and `custom.timeouts` (TUI) remove the default timeout of foreground shell commands. The default timeout returns only after you toggle `/timeouts` for the session. A `timeout` set on a call still applies. Background calls are not affected. The contract is in `packages/schema/src/custom-timeouts.ts`.

## Task Tool Invalid `task_id`

The plugin `custom.tool.subagent.resume` starts a new subagent when the `sessionID` is not a child of the current session. Before, the call failed.

## Vertical Tabs Default

Session tabs are vertical by default in the TUI (`tabs.layout`) and in the desktop app (`appearance.tabLayout`).

## Vertical Tab Title Wrapping (TUI)

In the expanded vertical rail, a long tab title wraps onto more rows, and the tab grows to fit. The compact rail and the project line crop the text.

## Vertical Tab Close Mark (TUI)

In the expanded vertical rail, hover over an idle tab to change its `•` to `✕`. Click the `✕` to close the tab. Horizontal tabs keep the close button of upstream.

## Vertical Tab Project Groups (TUI)

The expanded vertical rail groups tabs under project headers. It nests child sessions under their parent tab. You cannot reorder tabs by hand while `tabs.layout` is vertical.

## Vertical Tab Compact Layout (TUI)

In the expanded vertical rail, a tab shows a second line only when it has a worktree branch. Tabs of one project group have no gap between them. Idle tabs show `•`.

## Subagent List Order (TUI)

The vertical tab subtree lists these sessions, oldest first by `time.created`:

- unresolved children (running, pending, permission, or question)
- the child that you view
- the ancestors of these sessions

The subagent picker lists all children, oldest first by `time.created`.

## Diff Line Comments (TUI)

Drag down the line numbers of an edit, patch, or write block in the chat to select lines, as on GitHub. The TUI sends a comment on the selected lines to the session as a prompt.

## Message Actions Jump (TUI)

When you click a message, Message Actions does not show Jump to. The timeline still shows it.

## Session List Preview (TUI) [NOT MIGRATED]

On terminals that are 128 columns or wider, the session list (`<leader>l`) previews the latest messages of the highlighted session.

## Retitle After Compaction

The plugin `custom.session.retitle` writes a new title for a top-level session from the compaction summary. It runs after each compaction. It does not run when you renamed the session by hand.

## Skill Mentions Use `/`

Type `/skill-id` to mention a skill. The `/` menu in the TUI and in the app composer completes it. This replaces `@skill-id`. `@` still mentions files, agents, and references.

## Directory Links Open in Sublime Merge (TUI)

Click a markdown link to a directory (the path ends with `/`, for example `[core](packages/core/)`). The TUI copies the absolute path and runs `smerge` on it. If the path does not exist, the TUI shows an error toast.

## Context Sidebar

The plugins `custom.context` and `custom.sidebar.context` (TUI) fill the sidebar. It lists the instruction files and skills that the session loaded. It also lists one collapsible node for each session root. Click a root to copy its path.

## Pull Request Sidebar

The plugins `custom.pull-requests` and `custom.sidebar.pull-requests` (TUI) fill the sidebar. It lists the pull requests that the chat links, as `owner/repo#n`. Click an entry to open it. The plugin option `hosts` adds enterprise hosts.

## Cancel Tool

The `cancel` tool stops a background `shell` or `subagent` that the agent started. The agent passes the shell ID or the `sessionID` from the result of the `background: true` call. The result names this id. The tool refuses jobs that belong to another session.

The plugin `custom.tool.cancel-hints` tells the model to use `cancel`. It adds this to the shell tool description and to the background results.

## Session Roots

A session has one working directory. It can also have `roots`: extra directories that are in scope like the working directory. Access to a root needs no `external_directory` approval.

- Models add and remove roots with `session_root_add` and `session_root_remove` (plugin `custom.session.roots`). The API path is `/api/session/:sessionID/root`.
- The instruction files and skills of a root load into the context of the session.
- Session move is the move of upstream. It works with roots. `session.fork` also accepts an optional `directory`.
- In the TUI workspaces dialog, `ctrl+m` moves the session. `ctrl+y` adds a root.

## Session Move Disabled for Models

The plugin `custom.tool.session-move.disable` hides the `session_move` tool from models. Users can still move sessions.

## Instruction Filenames

`InstructionDiscovery.filenames` lists the instruction files that load automatically: `AGENTS.md`, `CLAUDE.local.md`, `AGENTS.local.md`, and `PATCH.md`. The walk at startup and the walk at read time use this list.
