import type { RGBA } from "@opentui/core"
import type { ComponentTheme } from "./component"

export function providerColor(theme: Pick<ComponentTheme, "categorical">, id: string): RGBA {
  const palette = theme.categorical
  const hash = [...id.toLowerCase()].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0)
  return palette[hash % palette.length][200]
}
