# Fork Additions

## Inline Skill Autocomplete

Type `/` mid-prompt (after whitespace) to trigger skill-only autocomplete. Skills can be inserted inline without replacing the entire prompt.

## Skill Configuration Options

```ts
skills: {
  slash?: boolean   // Show skills as slash commands (default: true)
  inline?: boolean  // Inline full skill content on invocation (default: false)
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

Added `make build-single` (builds the single-file `opencode` binary) and `make generate` (regenerates the SDK and related files).

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

Clicking an MCP in the sidebar enables or disables it. A new `connecting` status surfaces in-flight connections across the TUI, web app, and CLI.

## Prompt Stash Defaults

Default keybinds: `ctrl+s` to stash the current prompt, `ctrl+shift+s` to pop the last stashed prompt.

## Terminal Title Without `OC |` Prefix

Session and plugin terminal titles use the bare title/id (no `OC |` prefix).
