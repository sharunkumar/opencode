const enabled = process.env.OPENCODE_STARTUP_PROFILE === "1"
const started = performance.now()

export function mark(name: string, fields?: Record<string, string | number | boolean | undefined>) {
  if (!enabled) return
  write(`${name}.mark`, performance.now() - started, fields)
}

export function duration(
  name: string,
  startedAt: number,
  fields?: Record<string, string | number | boolean | undefined>,
) {
  if (!enabled) return
  write(name, performance.now() - startedAt, fields)
}

function write(name: string, durationMs: number, fields?: Record<string, string | number | boolean | undefined>) {
  const extra = fields
    ? Object.entries(fields)
        .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ")
    : ""
  console.error(`[startup-profile] ${name} ${Math.round(durationMs)}ms${extra ? ` ${extra}` : ""}`)
}

export * as StartupProfile from "./profile"
