.PHONY: build-single generate

BUN := mise exec -- bun

install-deps:
	$(BUN) install

build-single: install-deps
	$(BUN) run --cwd packages/opencode build --single

generate: install-deps
	./script/generate.ts
