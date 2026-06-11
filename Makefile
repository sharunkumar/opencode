.PHONY: build-single generate

build-single:
	bun run --cwd packages/opencode build --single

generate:
	./script/generate.ts
