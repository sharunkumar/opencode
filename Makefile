.PHONY: install-deps typecheck build-single generate tests

BUN := mise exec -- bun

# Tests for changes made in this fork, relative to each package.
TUI_FORK_TESTS := test/ui/directory-link.test.ts test/ui/directory-markdown.test.tsx test/util/session.test.ts
CORE_FORK_TESTS := test/plugin/custom.test.ts test/plugin/supervisor.test.ts test/tool-cancel.test.ts

install-deps:
	$(BUN) install

typecheck: install-deps
	$(BUN) run typecheck

build-single: typecheck
	$(BUN) run --cwd packages/cli build --single

tests:
	cd packages/tui && $(BUN) test $(TUI_FORK_TESTS)
	cd packages/core && $(BUN) test $(CORE_FORK_TESTS)

generate: install-deps
	./script/generate.ts
