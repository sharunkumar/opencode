# Fork Additions

## Skill Auto-Load

`auto_load` is a plugin (`custom.skills.auto-load`): configure it with `{ "plugins": [{ "package": "custom.skills.auto-load", "options": { "skills": ["a", "b"] } }] }` to inject those skills into main-session system prompts and omit them from `available_skills`.

## Builtin Plugin Options

A `plugins` config entry whose `package` is a builtin plugin id enables it and passes `options` to it. Wildcard entries (`custom.*`) pass no options.

## Disabled Workflows

Only `ci` runs on this fork. After merging upstream, run `make disable-workflows` to disable the rest.

## Removed Upstream Custom Tools

Deleted `.opencode/tool/github-pr-search.ts` and `github-triage.ts`: v1-style tools (`import { tool } from "@opencode/plugin"`) that fail to load on v2 and break every prompt run in this repo.

## Fork CI Workflow

`ci.yml` is the fork's only workflow: it checks pull requests and pushes to `dev`, and on a push to `dev` builds the CLI and publishes a datever GitHub Release.

## Makefile

`make build-single` builds the single-file `opencode` binary, `make generate` regenerates the protocol, client, and docs, `make tests` runs the fork's tests, and `make git-setup` registers the merge drivers below.

## Migration Merge Drivers

Git merge drivers (`packages/core/script/merge-driver.ts`) resolve `migration.gen.ts` and `schema.json` when upstream adds a migration next to the fork's. Run `make git-setup` once per clone.

## Interrupt-and-Submit Keybind (`prompt_interrupt_submit`)

`ctrl+return` (`prompt_interrupt_submit`) aborts the active run and submits the prompt as a fresh run. It needs the kitty keyboard protocol, and it is no longer a newline key.

## Click-to-Toggle MCPs in TUI Sidebar

Clicking an MCP in the sidebar enables or disables it. In-flight connections use status `pending` (upstream rename of `connecting`); the web UI still labels it "connecting". V1 servers that emit `connecting` are normalized to `pending` at the load boundary.

## Prompt Stash Defaults

Default keybinds: `ctrl+s` to stash the current prompt, `ctrl+shift+s` to pop the last stashed prompt.

## Terminal Title Without `OC |` Prefix

Session and plugin terminal titles use the bare title/id (no `OC |` prefix).

## Bash Tool Syntax Highlighting (TUI)

Bash/shell tool commands use tree-sitter bash highlighting. The `$ ` marker renders separately so the shell grammar only sees the command.

## Provider Colorization (TUI)

Each provider gets a stable theme color in the model picker and prompt footer.

## Model Keyword Highlights (TUI)

`cli.json` `model_keywords` (case-insensitive regexes) colors matching text in model names in the picker and prompt footer.

## Free Badge for Zero-Cost Models (TUI)

Model picker shows a `Free` footer for any model with `cost.input === 0`, not only `opencode` provider models.

## Agent Cycle Tab Strip (TUI)

Tab and Shift+Tab cycle agents forward and back, briefly showing a colored list of agents; click one to select it.

## `/timeouts` Command

Plugin (`custom.shell.timeouts` + TUI `custom.timeouts`): foreground shell commands have no default timeout until `/timeouts` is toggled for the session. Explicit `timeout` on a call still applies; background calls are untouched. Contract in `packages/schema/src/custom-timeouts.ts`.

## Task Tool Invalid `task_id`

Plugin (`custom.tool.subagent.resume`): a subagent `sessionID` that is not a child of the current session starts a new subagent instead of failing.

## Vertical Tabs Default

Session tabs default to vertical in the TUI (`tabs.layout`) and desktop app (`appearance.tabLayout`).

## Vertical Tab Title Wrapping (TUI)

Expanded vertical tab titles word-wrap onto as many rows as they need instead of cropping, and the tab grows to fit; the compact rail and project line still crop.

## Vertical Tab Close Mark (TUI)

In the expanded vertical rail, hovering an idle tab turns its `•` into `✕`; click it to close the tab. Horizontal tabs keep upstream's close button.

## Vertical Tab Project Groups (TUI)

The expanded vertical rail groups tabs under project headers and nests child sessions under their parent tab; manual tab reordering is disabled while `tabs.layout` is vertical.

## Vertical Tab Compact Layout (TUI)

In the expanded vertical rail, a tab shows a second line only when it has a worktree branch, tabs in one project group sit with no gap, and idle tabs show `•`.

## Subagent List Order (TUI)

The vertical tab subtree lists unresolved children (running, pending, permission, or question), the child being viewed, and ancestors of those, oldest-first by `time.created`. The subagent picker lists children oldest-first by `time.created`.

## Diff Line Comments (TUI)

Dragging down the line numbers of an in-chat edit, patch or write block picks lines, GitHub style, and sends a comment on them to the session as a prompt.

## Message Actions Jump (TUI)

Clicking a message hides Jump to in Message Actions. The timeline still shows it.

## Session List Preview (TUI) [NOT MIGRATED]

The session list (`<leader>l`) previews the highlighted session's latest messages on terminals 128 columns or wider.

## Retitle After Compaction

Plugin (`custom.session.retitle`): regenerates a top-level session's title from the compaction summary after every compaction, unless the session was renamed by hand.

## Skill Mentions Use `/`

Skills are mentioned and autocompleted as `/skill-id` (leading `/` menu in the TUI and app composer) instead of `@skill-id`; `@` stays for files, agents, and references.

## Directory Links Open in Sublime Merge (TUI)

Clicking a markdown link to a directory (trailing `/`, e.g. `[core](packages/core/)`) copies its absolute path and runs `smerge` on it; a missing path toasts an error. `make tests` runs the fork tests.

## Context Sidebar

Plugin (`custom.context` + TUI `custom.sidebar.context`): the sidebar lists the session's loaded instruction files, loaded skills, and one collapsible node per session root. Clicking a root copies its path.

## Pull Request Sidebar

Plugin (`custom.pull-requests` + TUI `custom.sidebar.pull-requests`): the sidebar lists pull requests linked in the chat as `owner/repo#n`; click to open. Add enterprise hosts with the `hosts` plugin option.

## Cancel Tool

`cancel` tool: agents cancel a background `shell` or `subagent` they started by passing the shell ID or subagent `sessionID` from its `background: true` result (which now names the id); jobs owned by another session are refused.

Plugin (`custom.tool.cancel-hints`): tells the model to use `cancel` in the shell tool's description and background results.

## Session Roots

A session has one working directory plus optional `roots`: extra directories that are in scope like it, with no `external_directory` approval.

- Models add and remove roots with `session_root_add` / `session_root_remove` (plugin `custom.session.roots`); the API has `/api/session/:sessionID/root`.
- A root's instruction files and skills load into the session's context.
- Session move is upstream's and works with roots; `session.fork` also takes an optional `directory`.
- In the TUI workspaces dialog, `ctrl+m` moves the session and `ctrl+y` adds a root.

## Session Move Disabled for Models

Plugin (`custom.tool.session-move.disable`): hides the `session_move` tool from models. Users can still move sessions.

## Instruction Filenames

Auto-loaded instruction filenames are `InstructionDiscovery.filenames` (`AGENTS.md`, `CLAUDE.local.md`, `AGENTS.local.md`, `PATCH.md`), shared by the startup walk and the read-time walk.
