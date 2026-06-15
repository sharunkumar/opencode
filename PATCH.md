# Fork Additions

## Inline Skill Autocomplete

Type `/` mid-prompt (after whitespace) to trigger skill-only autocomplete. Skills can be inserted inline without replacing the entire prompt.

## Skill Configuration Options

```ts
skills: {
  slash?: boolean   // Show skills as slash commands (default: false)
  inline?: boolean  // Inline full skill content on invocation (default: true)
}
```

## `/skills` Command

Browse and select skills via dialog. Hidden when `skills.slash` is enabled.

## UI Changes

- `DialogSelectSkill` component for skill browser
- Skill category in command palette
- i18n keys for skill UI

## Disabled Workflows

Upstream workflows disabled for this fork:

- close-issues, containers, deploy, docs-locale-sync
- nix-eval, nix-hashes, pr-management, pr-standards
- publish, release-github-action, storybook
- vouch-check-pr, vouch-manage-by-issue

Kept: test, typecheck, generate

## CI Runners

Changed from Blacksmith to GitHub-hosted runners (`ubuntu-latest`, `windows-latest`).

## Ripgrep WASM Fix

Added `--glob=!node_modules/*` to WASM ripgrep args to exclude node_modules when running from subdirectories where `.gitignore` is in a parent directory.

## Makefile

Added a `Makefile` with a `build-single` target that builds the single-file `opencode` binary and a `generate` target that runs `./script/generate.ts` to regenerate the SDK and related files.

## Startup Profiling

`OPENCODE_STARTUP_PROFILE=1` emits `[startup-profile] <phase> <ms>` lines to stderr for the lazy
startup phases that run on first access (after the TUI is already visible):

- `mcp.connect` — time to connect all configured MCP servers (fields: `configured`, `connected`)
- `skill.discover` — filesystem discovery of `SKILL.md` files (fields: `matches`, `dirs`)
- `skill.load` — discovery + parse of skills (field: `count`)
- `command.init` — build base command list: builtins + config + skills (field: `count`)
- `command.mcp-prompts` — background load of MCP prompt commands (field: `count`)
- `mcp.ready` / `skill.ready` / `command.ready` / `tui.first-frame` — module-load-relative marks

Implemented in `src/startup/profile.ts` (mirrors `src/acp/profile.ts`); instrumented in
`src/mcp/index.ts` (`MCP.state`), `src/skill/index.ts` (`Skill.discovery`/`Skill.state`),
`src/command/index.ts` (`Command.state`), and `src/cli/cmd/run/runtime.ts` (first frame).
Trigger in-process via `opencode mcp list`, `opencode debug skill`, and `opencode debug command`.

## Non-blocking MCP Prompt Commands

Previously `Command.state` (`src/command/index.ts`) awaited `mcp.prompts()` while building the
command list, so `GET /command` blocked on MCP connecting (~11s with a single `npx …@latest`
server). The TUI inline `/` skill autocomplete reads that command list, so skills appeared empty
until MCP was ready.

Now `Command.state` builds builtins + config + skills synchronously (fast) and folds MCP prompt
commands in on a background `Effect.forkScoped` fiber. When prompts finish loading it publishes a
new `command.changed` event (`Command.Event.Changed`, `type: "command.changed"`); the TUI
(`packages/tui/src/context/sync.tsx`) refetches `command.list` on that event, mirroring the
existing `lsp.updated` handler. Measured: first `GET /command` dropped from ~11s to ~0.3s.

Added `opencode debug command` (`src/cli/cmd/debug/command.ts`) to list commands / probe this path,
mirroring `opencode debug skill`. SDK regenerated for the new event type.

## Interrupt-and-Submit Keybind (`prompt_interrupt_submit`)

By default, submitting a prompt while the assistant is still working steers/queues the message into
the running loop (picked up at the next safe boundary, shown with a `QUEUED` badge). There was no way
to atomically interrupt the active run and send a new prompt immediately — you had to press `escape`
twice to abort, wait for idle, then submit.

Added a `prompt_interrupt_submit` keybind (default `ctrl+return`, i.e. Ctrl+Enter) mapped to the
command `prompt.interrupt_submit`. The handler (in `packages/tui/src/component/prompt/index.tsx`)
awaits `sdk.client.session.abort(...)` when the session is busy — the abort endpoint awaits
cancellation, so once it resolves the runner is idle (`SessionRunState.cancel` → `Runner.cancel`
interrupts the fiber and `onIdle` drops the runner) — then calls the normal `submit()`, so the prompt
starts a fresh run instead of being queued. On an empty prompt it is a no-op (does not interrupt).
When the session is already idle it behaves like a normal submit.

`ctrl+return` was previously part of `input_newline` (`shift+return,ctrl+return,alt+return,ctrl+j`);
it is removed from that default (now `shift+return,alt+return,ctrl+j`) so Ctrl+Enter is free for
interrupt-and-submit. Newline still has `shift+return`, `alt+return`, and `ctrl+j`.

Ctrl+Enter is distinct from plain Enter only under the kitty keyboard protocol (which opencode
enables via `useKittyKeyboard`); terminals/multiplexers without it collapse Ctrl+Enter into a plain
newline. The original `super+return` (Cmd+Enter) default was dropped because macOS terminals reserve
Cmd and do not forward it to the app.

Definition + `CommandMap` entry live in `packages/tui/src/config/keybind.ts`; the binding is gathered
in the existing `prompt.palette` group. Like `prompt.submit`, the command is hidden from the palette.

## Shell Tool Identity Env (OPENCODE / AGENT)

Shells spawned by the bash/shell tool stopped exposing `OPENCODE=1` and `AGENT=1`. These let shell
prompts and scripts detect they are running inside opencode (the use case from upstream request
#1775). They were only ever set via the `index.ts` CLI middleware on `process.env`, and the process
that runs `ShellTool` no longer inherits them, so `shellEnv` (`src/tool/shell.ts`), which merges
`{ ...process.env, ...pluginShellEnv }`, had nothing to forward.

Fixed by appending `OPENCODE: "1"` / `AGENT: "1"` after the plugin `shell.env` output in `shellEnv`,
so they are always present and authoritative (a plugin `shell.env` hook cannot clobber the identity
markers, but can still add other vars). Covered by a real-shell test that unsets both vars on
`process.env` first to prove the tool injects them.
