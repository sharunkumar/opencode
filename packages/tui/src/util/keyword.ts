export interface KeywordSpan {
  start: number
  end: number
  keyword: string
}

export function match(text: string, patterns: readonly string[]): KeywordSpan[] {
  const candidates: KeywordSpan[] = []
  for (const pattern of patterns) {
    if (!pattern) continue
    const regex = compile(pattern)
    if (!regex) continue
    for (const found of text.matchAll(regex)) {
      if (found[0].length === 0) continue
      candidates.push({ start: found.index, end: found.index + found[0].length, keyword: pattern })
    }
  }
  candidates.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
  const spans: KeywordSpan[] = []
  let lastEnd = 0
  for (const candidate of candidates) {
    if (candidate.start < lastEnd) continue
    spans.push(candidate)
    lastEnd = candidate.end
  }
  return spans
}

function compile(pattern: string) {
  try {
    return new RegExp(pattern, "gi")
  } catch {
    return undefined
  }
}

export * as Keyword from "./keyword"
