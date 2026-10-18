import type { RGBA } from "@opentui/core"
import type { ComponentTheme } from "./component"

export function providerColor(theme: Pick<ComponentTheme, "categorical">, id: string): RGBA {
  return labelColor(theme, id, 0)
}

export function keywordColor(theme: Pick<ComponentTheme, "categorical">, keyword: string, providers: number): RGBA {
  return labelColor(theme, keyword, providers)
}

export function labelColor(theme: Pick<ComponentTheme, "categorical">, key: string, offset: number): RGBA {
  const palette = theme.categorical
  const hash = [...key.toLowerCase()].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0)
  return palette[(hash + offset) % palette.length][200]
}
