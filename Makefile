.PHONY: install-deps typecheck build-single generate tests

BUN := mise exec -- bun

# Tests for changes made in this fork, relative to packages/tui.
FORK_TESTS := test/ui/directory-link.test.ts

install-deps:
	$(BUN) install

typecheck: install-deps
	$(BUN) run typecheck

build-single: typecheck
	$(BUN) run --cwd packages/cli build --single

tests:
	cd packages/tui && $(BUN) test $(FORK_TESTS)

generate: install-deps
	./script/generate.ts
