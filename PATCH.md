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

Added a `Makefile` with a `build-single` target that builds the single-file `opencode` binary.

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
