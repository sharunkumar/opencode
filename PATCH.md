# Fork Additions

## Skill Auto-Load

`auto_load` is a plugin (`custom.skills.auto-load`): set `OPENCODE_AUTO_LOAD_SKILLS=a,b` to inject those skills into main-session system prompts and omit them from `available_skills`.

## UI Changes [STALE: skill browser migrated as `/skills`; command-palette category NOT MIGRATED]

Skill browser dialog and a skill category in the command palette.

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

Added `make build-single` (builds the single-file `opencode` binary from `packages/cli`) and `make generate` (regenerates the SDK and related files).

## Startup Profiling [NOT MIGRATED, check if still needed]

`OPENCODE_STARTUP_PROFILE=1` emits `[startup-profile] <phase> <ms>` lines to stderr for the lazy startup phases (MCP connect, skill discovery/load, command-list init, MCP prompt commands, and readiness marks). Trigger in-process via `opencode mcp list`, `opencode debug skill`, and `opencode debug command`.

## Non-blocking MCP Prompt Commands [NOT MIGRATED, check if v2 still blocks]

Building the command list no longer blocks on MCP connecting (previously ~11s with a single `npx …@latest` server), which left the TUI inline `/` skill autocomplete empty until MCP was ready. Commands now build synchronously and MCP prompt commands fold in on a background fiber, emitting a `command.changed` event the TUI refetches on. First `GET /command` dropped from ~11s to ~0.3s. Added `opencode debug command` to inspect this path.

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

## Agent Cycle Tab Strip (TUI) [NOT MIGRATED, needs spike]

Tab / Shift+Tab cycles agents and briefly shows a colored tab list of all primary agents (agent color as background on the active tab). Settles back to the normal agent/model footer after 500ms idle.

## `/timeouts` Command

Plugin (`custom.shell.timeouts` + TUI `custom.timeouts`): foreground shell commands have no default timeout until `/timeouts` is toggled for the session. Explicit `timeout` on a call still applies; background calls are untouched. Contract in `packages/schema/src/custom-timeouts.ts`.

## Task Tool Invalid `task_id`

Plugin (`custom.tool.subagent.resume`): a subagent `sessionID` that is not a child of the current session starts a new subagent instead of failing.

## Session List Preview (TUI) [NOT MIGRATED]

The session list (`<leader>l`) previews the highlighted session's latest messages on terminals 128 columns or wider.

## Retitle After Compaction

Plugin (`custom.session.retitle`): regenerates the session title from the compaction summary after every compaction.
