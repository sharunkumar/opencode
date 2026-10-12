.PHONY: install-deps build-single generate

BUN := mise exec -- bun

install-deps:
	$(BUN) install

build-single: install-deps
	$(BUN) run --cwd packages/cli build --single
	mv packages/cli/dist/cli-*/bin/opencode packages/cli/dist/opencode2

generate: install-deps
	./script/generate.ts
