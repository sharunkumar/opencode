# Fork Additions

## Skill Auto-Load

`auto_load` is a plugin (`custom.skills.auto-load`): configure it with `{ "plugins": [{ "package": "custom.skills.auto-load", "options": { "skills": ["a", "b"] } }] }` to inject those skills into main-session system prompts and omit them from `available_skills`.

## Builtin Plugin Options

A `plugins` config entry whose `package` exactly matches a builtin (or SDK/instance) plugin id enables it and passes `options` as `ctx.options`; it is never installed as a package. Wildcard selectors (`custom.*`) do not pass options. Options are folded into the plugin revision, so editing them reloads the plugin. Plugins should decode `ctx.options` with a schema at their own boundary.

## Disabled Workflows

Upstream workflows disabled for this fork:

- close-issues, containers, deploy, docs-locale-sync
- nix-eval, nix-hashes, pr-management, pr-standards
- publish, release-github-action, storybook
- vouch-check-pr, vouch-manage-by-issue

Kept: test, typecheck, generate

## CI Runners

Changed from Blacksmith to GitHub-hosted runners (`ubuntu-latest`, `windows-latest`) in `check` and `test`.

## Removed Upstream Custom Tools

Deleted `.opencode/tool/github-pr-search.ts` and `github-triage.ts`: v1-style tools (`import { tool } from "@opencode/plugin"`) that fail to load on v2 and break every prompt run in this repo.

## Fork Release Workflow

`release.yml`: on push to `dev` (forks only), runs `bun run check`, builds all `packages/cli` targets, archives them as `opencode-<os>-<arch>[-baseline][-musl].{zip,tar.gz}`, and uploads to a datever GitHub Release.

## Makefile

Added `make build-single` (builds the single-file `opencode` binary from `packages/cli`) and `make generate` (regenerates the protocol, client, and docs, then formats only the files generation touched; upstream's script formats the whole repo, which is not prettier-clean).

## Interrupt-and-Submit Keybind (`prompt_interrupt_submit`)

Submitting while the assistant is working normally steers/queues the message (shown with a `QUEUED` badge). The new `prompt_interrupt_submit` keybind (default `ctrl+return`, command `prompt.interrupt_submit`) instead aborts the active run and then submits, so the prompt starts a fresh run. No-op on an empty prompt; behaves like a normal submit when idle.

`ctrl+return` is removed from `input_newline` (now `shift+return,alt+return,ctrl+j`) so Ctrl+Enter is free. Ctrl+Enter is distinct from plain Enter only under the kitty keyboard protocol; without it, terminals collapse it into a newline. `super+return` (Cmd+Enter) was dropped because macOS terminals reserve Cmd.

## Click-to-Toggle MCPs in TUI Sidebar

Clicking an MCP in the sidebar enables or disables it. In-flight connections use status `pending` (upstream rename of `connecting`); the web UI still labels it "connecting". V1 servers that emit `connecting` are normalized to `pending` at the load boundary.

## Prompt Stash Defaults

Default keybinds: `ctrl+s` to stash the current prompt, `ctrl+shift+s` to pop the last stashed prompt.

## Terminal Title Without `OC |` Prefix

Session and plugin terminal titles use the bare title/id (no `OC |` prefix).

## Bash Tool Syntax Highlighting (TUI)

Bash/shell tool commands use tree-sitter bash highlighting. The `$ ` marker renders separately so the shell grammar only sees the command.

## Provider Colorization (TUI)

Providers get stable theme colors (like agents/modes) in the model picker and prompt footer. `providerColor(theme, id)` hashes the provider id into the theme's `categorical` palette, the same role agents use; there are no per-provider brand hues. `DialogSelect` takes an optional `colorBy` callback so the widget stays domain-agnostic; the model dialog wires it for `{ providerID }` values.

## Model Keyword Highlights (TUI)

`cli.json` `model_keywords: string[]` colorizes matching substrings in model names in the picker and prompt footer. Each entry is a case-insensitive regex (a plain string matches itself); first non-overlapping, longest matches win and only the matched span is tinted. Keyword colors are offset by the provider count in the same `categorical` palette so they stay distinct until it wraps. A v1 `tui.json` `model_keywords` entry is not read.

## Free Badge for Zero-Cost Models (TUI)

Model picker shows a `Free` footer for any model with `cost.input === 0`, not only `opencode` provider models.

## Agent Cycle Tab Strip (TUI)

Tab cycles to the next agent and Shift+Tab to the previous one (`agent.cycle` / `agent.cycle.reverse`). Cycling briefly shows a colored tab list of visible agents (agent color as background on the active tab, black or white text by luminance). Settles back to the normal agent/model footer after 500ms idle. Clicking a tab selects it and closes the strip.

## `/timeouts` Command

Plugin (`custom.shell.timeouts` + TUI `custom.timeouts`): foreground shell commands have no default timeout until `/timeouts` is toggled for the session. Explicit `timeout` on a call still applies; background calls are untouched. Contract in `packages/schema/src/custom-timeouts.ts`.

## Task Tool Invalid `task_id`

Plugin (`custom.tool.subagent.resume`): a subagent `sessionID` that is not a child of the current session starts a new subagent instead of failing.

## Vertical Tabs Default

Session tabs default to vertical in the TUI (`tabs.layout`) and desktop app (`appearance.tabLayout`).

## Vertical Tab Title Wrapping (TUI)

Expanded vertical tab titles word-wrap onto as many rows as they need instead of cropping, and the tab grows to fit; the compact rail and project line still crop.

## Vertical Tab Close Button Removed (TUI)

The hover `✕` is gone from vertical tabs (middle-click still closes); horizontal tabs keep it.

## Vertical Tab Project Groups (TUI)

The expanded vertical rail groups tabs under project headers and nests child sessions under their parent tab; manual tab reordering is disabled while `tabs.layout` is vertical.

## Vertical Tab Compact Layout (TUI)

In the expanded vertical rail, the project name shows only in the group header, not again on each tab's detail line; the detail row renders only when there is a worktree branch (`⎇ branch`). Tabs under the same project header sit directly under each other with no blank row (and no separator pulse between them), and idle tabs show a `•` in the status column. Compact rail, tooltips, and horizontal tabs are unchanged.

## Subagent List Order (TUI)

The vertical tab subtree lists unresolved children (running, pending, permission, or question), the child being viewed, and ancestors of those, oldest-first by `time.created`. The subagent picker lists children oldest-first by `time.created`.

## Message Actions Jump (TUI)

Clicking a message hides Jump to in Message Actions. The timeline still shows it.

## Session List Preview (TUI) [NOT MIGRATED]

The session list (`<leader>l`) previews the highlighted session's latest messages on terminals 128 columns or wider.

## Retitle After Compaction

Plugin (`custom.session.retitle`): regenerates the session title from the compaction summary after every compaction.

## Skill Mentions Use `/`

Skills are mentioned and autocompleted as `/skill-id` (leading `/` menu in the TUI and app composer) instead of `@skill-id`; `@` stays for files, agents, and references.

## Directory Links Open in Sublime Merge (TUI)

Clicking a markdown link to a directory (trailing `/`, e.g. `[core](packages/core/)`) copies its absolute path and runs `smerge` on it; a missing path toasts an error. `make tests` runs the fork tests.

## Context Sidebar

Plugin (`custom.context` + TUI `custom.sidebar.context`): the sidebar lists the current session's context as **Instructions** (ambient and session-injected instruction files; home paths show as `~`, and a symlinked global config dir shows the configured path), **Skills** (by name: mentions, `skill` messages, and completed `skill` tool calls in the post-compaction window, plus skills from `custom.skills.auto-load` via `custom-auto-load-skills`), and one node per session root. The backend takes each root's Instructions from `SessionRoots` (the same files the model receives) and groups loaded Skills by the root that provides them (a skill the primary Location also has stays under the primary Skills). Each root renders as a top-level node next to Instructions and Skills, labelled with its directory (displayed like other paths: project-relative, else `~`); there is no explicit "Roots" header. Root nodes start collapsed and a click on the root's label toggles its contents and copies the root's absolute path (with a toast; no icons; the open state is not persisted). Empty subsections are hidden; Instructions and Skills never collapse.

## Pull Request Sidebar

Plugin (`custom.pull-requests` + TUI `custom.sidebar.pull-requests`): the sidebar lists pull requests linked in user messages and assistant replies (not tool calls, reasoning, or other transcript noise) as `owner/repo#n`; clicking one opens it. Only full `https://<host>/<owner>/<repo>/pull/<n>` URLs match. github.com is always recognized; add enterprise hosts with `{ "plugins": [{ "package": "custom.pull-requests", "options": { "hosts": ["ghe.example.com"] } }] }`. Two or fewer stay expanded; more collapse behind a click toggle.

## Cancel Tool

`cancel` tool: agents cancel a background `shell` or `subagent` they started by passing the shell ID or subagent `sessionID` from its `background: true` result (which now names the id); jobs owned by another session are refused.

## Session Roots (Move Removed)

Sessions keep one working directory (`location`) plus optional `roots`: extra directories that are in scope like the working directory, so reading and editing inside them skips `external_directory` approval. Add and remove roots with `session_root_add` / `session_root_remove` (Code Mode `opencode` namespace), `POST`/`DELETE /api/session/:sessionID/root`, or `session.root.add` / `session.root.remove` on the client and plugin APIs. Roots are event-sourced (`session.root.added` / `session.root.removed`), inherited by child sessions and forks, and listed in the system prompt; commands still run in the working directory.

Roots are first-class context. `SessionRoots` (Location-scoped) discovers each root's instruction files (walked up to the root's project root, minus files the primary Location already loads and global config files) and skills (`.opencode/skill(s)`, `.claude/skills`, `.agents/skills`). `SessionContext.select` adds the root instructions as one `core/roots` instruction source and merges root skills into the available-skills list. The skill tool, `/skill` mentions, and `Session.skill` resolve skills through `SessionRoots.skill`: the primary Location wins an ID collision, then earlier roots. Discovery is not watched; it re-reads the filesystem on each step. A root's own `opencode.json` (config, `instructions`, `skills` entries, plugins) is not loaded.

Moving a session is gone: the `session_move` tool, `/api/session/:sessionID/move`, the `SessionMove` service, and every UI entry point. `session.moved` and inbox `move` items stay decodable for old logs; the runner consumes legacy move items as no-ops. A session whose directory is missing is recovered by forking it into another directory (`session.fork` takes an optional `directory`).

## Instruction Filenames

Auto-loaded instruction filenames are `InstructionDiscovery.filenames` (`AGENTS.md`, `CLAUDE.local.md`, `AGENTS.local.md`, `PATCH.md`), shared by the startup walk and the read-time walk.
