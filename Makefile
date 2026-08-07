.PHONY: build-single generate lildax

install-deps:
	bun install

build-single: install-deps
	bun run --cwd packages/opencode build --single

lildax: install-deps
	bun run --cwd packages/cli build --single

generate: install-deps
	./script/generate.ts
