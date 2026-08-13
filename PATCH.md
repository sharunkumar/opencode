# Fork Additions

## Inline Skill Autocomplete

Type `/` mid-prompt (after whitespace) to trigger skill-only autocomplete. Skills can be inserted inline without replacing the entire prompt.

## Skill Configuration Options

```ts
skills: {
  slash?: boolean     // Show skills as slash commands (default: true)
  inline?: boolean    // Inline full skill content on invocation (default: false)
  auto_load?: string[] // Skill names injected into main-session system prompt; omitted from available_skills
}
```

## `/skills` Command

Browse and select skills via dialog. Hidden when `skills.slash` is enabled.

## UI Changes

Skill browser dialog and a skill category in the command palette.

## Disabled Workflows

Upstream workflows disabled for this fork:

- close-issues, containers, deploy, docs-locale-sync
- nix-eval, nix-hashes, pr-management, pr-standards
- publish, release-github-action, storybook
- vouch-check-pr, vouch-manage-by-issue

Kept: test, typecheck, generate

## CI Runners

Changed from Blacksmith to GitHub-hosted runners (`ubuntu-latest`, `windows-latest`).

## Fork Release Workflow

`release.yml`: fork-friendly workflow that builds and creates a GitHub Release on push to `dev`.

## Makefile

Added `make build-single` (builds the single-file `opencode` binary), `make lildax` (builds the v2 `lildax` binary), and `make generate` (regenerates the SDK and related files).

## Startup Profiling

`OPENCODE_STARTUP_PROFILE=1` emits `[startup-profile] <phase> <ms>` lines to stderr for the lazy startup phases (MCP connect, skill discovery/load, command-list init, MCP prompt commands, and readiness marks). Trigger in-process via `opencode mcp list`, `opencode debug skill`, and `opencode debug command`.

## Non-blocking MCP Prompt Commands

Building the command list no longer blocks on MCP connecting (previously ~11s with a single `npx …@latest` server), which left the TUI inline `/` skill autocomplete empty until MCP was ready. Commands now build synchronously and MCP prompt commands fold in on a background fiber, emitting a `command.changed` event the TUI refetches on. First `GET /command` dropped from ~11s to ~0.3s. Added `opencode debug command` to inspect this path.

## Interrupt-and-Submit Keybind (`prompt_interrupt_submit`)

Submitting while the assistant is working normally steers/queues the message (shown with a `QUEUED` badge). The new `prompt_interrupt_submit` keybind (default `ctrl+return`, command `prompt.interrupt_submit`) instead aborts the active run and then submits, so the prompt starts a fresh run. No-op on an empty prompt; behaves like a normal submit when idle.

`ctrl+return` is removed from `input_newline` (now `shift+return,alt+return,ctrl+j`) so Ctrl+Enter is free. Ctrl+Enter is distinct from plain Enter only under the kitty keyboard protocol; without it, terminals collapse it into a newline. `super+return` (Cmd+Enter) was dropped because macOS terminals reserve Cmd.

## Shell Tool Identity Env (OPENCODE / AGENT)

Shells spawned by the bash/shell tool always expose `OPENCODE=1` and `AGENT=1` so prompts and scripts can detect they run inside opencode (upstream #1775). A plugin `shell.env` hook can add vars but cannot clobber these markers.

## Click-to-Toggle MCPs in TUI Sidebar

Clicking an MCP in the sidebar enables or disables it. In-flight connections use status `pending` (upstream rename of `connecting`); the web UI still labels it "connecting". V1 servers that emit `connecting` are normalized to `pending` at the load boundary.

## Prompt Stash Defaults

Default keybinds: `ctrl+s` to stash the current prompt, `ctrl+shift+s` to pop the last stashed prompt.

## Terminal Title Without `OC |` Prefix

Session and plugin terminal titles use the bare title/id (no `OC |` prefix).

## Leading `@subagent` Direct Invoke

A prompt that starts with `@explore …` / `@general …` (etc.) skips the primary LLM and launches that subagent as a background subtask, so the parent stays idle for parallel invokes. Mid-prompt `@agent` still uses the synthetic task-tool hint.

## Bash Tool Syntax Highlighting (TUI)

Bash/shell tool commands use tree-sitter bash highlighting.

## Provider Colorization (TUI)

Providers get stable theme colors (like agents/modes) in the model picker and prompt footer. `providerColor(theme, id)` maps common providers to brand hues and hashes the rest (palette excludes `error`). `DialogSelect` takes an optional `colorBy` callback so the widget stays domain-agnostic; the model dialog wires it for `{ providerID }` values and string provider ids.

## Model Keyword Highlights (TUI)

`tui.json` `model_keywords: string[]` colorizes matching substrings in model names in the picker and prompt footer. Each entry is a case-insensitive regex (a plain string matches itself); first non-overlapping, longest matches win and only the matched span is tinted. Providers and keywords draw from one shared palette so their colors stay distinct until it wraps.
