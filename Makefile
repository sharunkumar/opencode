.PHONY: build-single generate

install-deps:
	bun install

build-single: install-deps
	bun run --cwd packages/opencode build --single

generate: install-deps
	./script/generate.ts
