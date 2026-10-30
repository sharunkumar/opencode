.PHONY: install-deps git-setup typecheck build-single generate tests

BUN := mise exec -- bun

# Tests for changes made in this fork, relative to each package.
TUI_FORK_TESTS := test/ui/directory-link.test.ts test/ui/directory-markdown.test.tsx test/util/session.test.ts \
	test/cli/tui/data.test.tsx test/cli/tui/dialog-open.test.tsx test/cli/tui/prompt-move.test.tsx test/config.test.tsx \
	test/context/session-tabs.test.tsx test/app-lifecycle.test.tsx
CORE_FORK_TESTS := test/plugin/custom.test.ts test/plugin/supervisor.test.ts test/tool-cancel.test.ts \
	test/session-create.test.ts test/session-roots.test.ts test/session-skill.test.ts test/session-generate.test.ts \
	test/session-owned.test.ts test/session-runner.test.ts test/tool-skill.test.ts test/file-access.test.ts \
	test/bus-session-routing.test.ts test/subagent-lifetime.test.ts test/websearch.test.ts test/v1-migration.test.ts \
	test/session-move.test.ts test/tool-opencode.test.ts test/merge-driver.test.ts
SCHEMA_FORK_TESTS := test/event-manifest.test.ts
SDK_FORK_TESTS := test/instances-effect.test.ts

install-deps: git-setup
	$(BUN) install

# Merge drivers for the generated migration files named in .gitattributes.
git-setup:
	git config merge.opencode-migration-registry.name "opencode migration registry"
	git config merge.opencode-migration-registry.driver "$(BUN) packages/core/script/merge-driver.ts registry %O %A %B"
	git config merge.opencode-schema-snapshot.name "opencode schema snapshot"
	git config merge.opencode-schema-snapshot.driver "$(BUN) packages/core/script/merge-driver.ts snapshot %O %A %B"

typecheck: install-deps
	$(BUN) run typecheck

build-single: typecheck
	$(BUN) run --cwd packages/cli build --single

tests: install-deps
	cd packages/tui && $(BUN) run test $(TUI_FORK_TESTS)
	cd packages/core && $(BUN) run test $(CORE_FORK_TESTS)
	cd packages/schema && $(BUN) run test $(SCHEMA_FORK_TESTS)
	cd packages/sdk && $(BUN) run test $(SDK_FORK_TESTS)

generate: install-deps
	./script/generate.ts
