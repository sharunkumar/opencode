import { describe, expect } from "bun:test"
import { Bus } from "@opencode/core/bus"
import { Location } from "@opencode/core/location"
import { Plugin } from "@opencode/core/plugin"
import { CustomRetitlePlugin } from "@opencode/core/plugin/custom/retitle"
import { PluginHooks } from "@opencode/core/plugin/hooks"
import { PluginHost } from "@opencode/core/plugin/host"
import { Session } from "@opencode/core/session"
import { SessionEvent } from "@opencode/core/session/event"
import { Model } from "@opencode/schema/model"
import { Provider } from "@opencode/schema/provider"
import { Effect } from "effect"
import { testEffect } from "../lib/effect"
import { eventually } from "../lib/eventually"
import { PluginTestLayer } from "./fixture"

const it = testEffect(PluginTestLayer)

// The real plugin host and event bus, with a fixed model reply for the title request.
const setup = Effect.gen(function* () {
  const sessions = yield* Session.Service
  const location = yield* Location.Service
  const real = yield* PluginHost.make(yield* Plugin.Service, "test")
  const generated: string[] = []
  yield* CustomRetitlePlugin.Plugin.effect({
    ...real,
    session: {
      ...real.session,
      generate: (input) =>
        Effect.sync(() => {
          generated.push(input.sessionID)
          return { text: "Generated title\nextra line" }
        }),
    },
  })
  const session = yield* sessions.create({ location: Location.Ref.make({ directory: location.directory }) })
  return { sessions, session, generated }
})

const compacted = (sessionID: Session.ID) =>
  Effect.gen(function* () {
    const bus = yield* Bus.Service
    yield* bus.publish(SessionEvent.Compaction.Ended, { sessionID, reason: "auto", text: "Summary of the work" })
  })

const manual = (session: Session.Info) => session.metadata?.[CustomRetitlePlugin.METADATA_KEY]

describe("custom.session.retitle", () => {
  it.live("retitles an automatically titled session after compaction", () =>
    Effect.gen(function* () {
      const { sessions, session, generated } = yield* setup
      const hooks = yield* PluginHooks.Service
      // Upstream's auto-title fires the title hook, then renames.
      yield* hooks.trigger("session", "title", {
        sessionID: session.id,
        model: Model.Ref.make({ providerID: Provider.ID.make("test"), id: Model.ID.make("model") }),
        system: [],
        messages: [],
        options: {},
      })
      yield* sessions.rename({ sessionID: session.id, title: "First auto title" })

      yield* compacted(session.id)
      const retitled = yield* eventually(sessions.get(session.id), (info) => info.title === "Generated title")
      expect(generated).toEqual([session.id])
      expect(manual(retitled)).toBeUndefined()
    }),
  )

  it.live("marks a manual rename and keeps that title through compaction", () =>
    Effect.gen(function* () {
      const { sessions, session, generated } = yield* setup
      yield* sessions.rename({ sessionID: session.id, title: "My own title" })
      yield* eventually(sessions.get(session.id), (info) => manual(info) !== undefined)

      yield* compacted(session.id)
      yield* compacted(session.id)
      // Compactions are handled in order on one subscription, so retitling an unmarked session compacted after
      // them proves both were seen.
      const location = yield* Location.Service
      const other = yield* sessions.create({ location: Location.Ref.make({ directory: location.directory }) })
      yield* compacted(other.id)
      yield* eventually(sessions.get(other.id), (info) => info.title === "Generated title")
      expect(generated).toEqual([other.id])
      const after = yield* sessions.get(session.id)
      expect(after.title).toBe("My own title")
      expect(manual(after)).toEqual({ manual: true })
    }),
  )

  it.live("keeps other metadata keys when it marks a session", () =>
    Effect.gen(function* () {
      const { sessions, session } = yield* setup
      yield* sessions.setMetadata({ sessionID: session.id, metadata: { owner: "someone" } })
      yield* sessions.rename({ sessionID: session.id, title: "Hand made" })
      const marked = yield* eventually(sessions.get(session.id), (info) => manual(info) !== undefined)
      expect(marked.metadata).toEqual({ owner: "someone", [CustomRetitlePlugin.METADATA_KEY]: { manual: true } })
    }),
  )
})
