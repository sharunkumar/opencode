import { expect, test } from "bun:test"
import { migrateV1, resolveThemeDocument } from "../src/tui/index.js"
import type { ThemeV1Json } from "../src/tui/v1.js"

const source: ThemeV1Json = await Bun.file(
  new URL("../../tui/src/theme/assets/opencode.json", import.meta.url),
).json()
const document = migrateV1(source)

test.each(["light", "dark"] as const)("resolves %s themes without status tokens", (mode) => {
  const theme = resolveThemeDocument(document, mode)
  expect("status" in theme.text).toBeFalse()
  expect(theme.hue.accent[800]).toBeDefined()
  expect(theme.hue.interactive[800]).toBeDefined()
})

test.each(["light", "dark"] as const)(
  "gives %s themes without diff selection colors their interactive hue",
  (mode) => {
    const theme = resolveThemeDocument(document, mode)
    expect(theme.diff.background.selected).toEqual(theme.hue.interactive[700])
    expect(theme.diff.highlight.selected).toEqual(theme.hue.interactive[200])
  },
)
