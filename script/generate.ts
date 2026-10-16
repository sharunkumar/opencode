#!/usr/bin/env bun

import { $ } from "bun"

await $`bun run generate`.cwd("packages/protocol")

await $`bun run generate`.cwd("packages/client")

await $`bun run generate`.cwd("services/www")

// Upstream does not keep the repo prettier-clean, so format only what generation touched.
const changed = (await $`git diff --name-only --diff-filter=AM`.text()).split("\n").filter(Boolean)
const untracked = (await $`git ls-files --others --exclude-standard`.text()).split("\n").filter(Boolean)
const files = [...changed, ...untracked]
if (files.length) await $`bun run prettier --ignore-unknown --write ${files}`
