.PHONY: install-deps git-setup disable-workflows typecheck build-single generate tests

BUN := mise exec -- bun

install-deps: git-setup
	$(BUN) install

# Merge drivers for the generated migration files named in .gitattributes.
git-setup:
	git config merge.opencode-migration-registry.name "opencode migration registry"
	git config merge.opencode-migration-registry.driver "$(BUN) packages/core/script/merge-driver.ts registry %O %A %B"
	git config merge.opencode-schema-snapshot.name "opencode schema snapshot"
	git config merge.opencode-schema-snapshot.driver "$(BUN) packages/core/script/merge-driver.ts snapshot %O %A %B"

FORK_REPO := sharunkumar/opencode
KEPT_WORKFLOWS := ci

# Disables every active workflow not in KEPT_WORKFLOWS; run after merging upstream.
disable-workflows:
	GH_HOST=github.com gh workflow list -R $(FORK_REPO) --json id,name --jq '.[] | "\(.id) \(.name)"' | \
	while read -r id name; do \
		case " $(KEPT_WORKFLOWS) " in *" $$name "*) continue;; esac; \
		echo "disabling $$name"; \
		GH_HOST=github.com gh workflow disable "$$id" -R $(FORK_REPO); \
	done

typecheck: install-deps
	$(BUN) run typecheck

build-single: typecheck
	$(BUN) run --cwd packages/cli build --single

tests: install-deps
	# Merges keep the fork's generated files as text, but upstream can add sections that only regeneration fills in.
	cd packages/protocol && $(BUN) run check:generated
	cd packages/client && $(BUN) run check:generated
	$(BUN) turbo run test:fork --filter=@opencode/tui --filter=@opencode/core --filter=@opencode/schema --filter=@opencode/sdk --filter=@opencode/server --filter=@opencode/session-ui

generate: install-deps
	./script/generate.ts
