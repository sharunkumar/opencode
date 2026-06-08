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
