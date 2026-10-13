export * as CustomPullRequestsPlugin from "./pull-requests.js"

import { define } from "@opencode/plugin/effect/plugin"
import { CustomPullRequests } from "@opencode/schema/custom-pull-requests"
import { Effect, Option, Schema } from "effect"
import { SessionMessage } from "../../session/message.js"

const Options = Schema.Struct({ hosts: Schema.optional(Schema.Array(Schema.String)) })

// Lists pull request URLs written by the user or in an assistant reply. Tool calls, reasoning,
// and other transcript noise are ignored. `hosts` adds GitHub Enterprise hosts; github.com is always recognized.
export const Plugin = define({
  id: "custom.pull-requests",
  effect: Effect.fn("CustomPullRequestsPlugin")(function* (ctx) {
    const hosts = hostList(ctx.options)

    yield* ctx.rpc
      .register(CustomPullRequests.Contract, {
        list: (input) =>
          ctx.session.context({ sessionID: input.sessionID }).pipe(
            Effect.map((history) => ({ pullRequests: pullRequests(hosts, history) })),
            Effect.orDie,
          ),
      })
      .pipe(Effect.orDie)
  }),
})

export function hostList(options: unknown) {
  const configured = Option.getOrUndefined(Schema.decodeUnknownOption(Options)(options))?.hosts ?? []
  const hosts = ["github.com", ...configured.map(normalizeHost)].filter((host) => host !== "")
  return [...new Set(hosts)]
}

export function pullRequests(hosts: ReadonlyArray<string>, history: ReadonlyArray<SessionMessage.Info>) {
  const hostPattern = hosts.map((host) => host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
  const pattern = new RegExp(`https?://(${hostPattern})/([\\w.-]+)/([\\w.-]+)/pull/(\\d+)`, "gi")
  const found = new Map<string, { url: string; label: string }>()
  history
    .flatMap(messageText)
    .flatMap((text) => [...text.matchAll(pattern)])
    .forEach((match) => {
      const url = `https://${match[1].toLowerCase()}/${match[2]}/${match[3]}/pull/${match[4]}`
      if (!found.has(url)) found.set(url, { url, label: `${match[2]}/${match[3]}#${match[4]}` })
    })
  return [...found.values()]
}

// Accepts a bare host or a URL, since enterprise hosts are often copied from a browser address bar.
function normalizeHost(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase()
}

function messageText(message: SessionMessage.Info): string[] {
  if (message.type === "user") return [message.text]
  if (message.type !== "assistant") return []
  return message.content.flatMap((part) => (part.type === "text" ? [part.text] : []))
}
