export * as SessionDestination from "./destination.js"

import type { SessionFork } from "@opencode/schema/session-fork"
import { makeGlobalNode } from "@opencode/util/effect/app-node"
import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { Cause, Context, Effect, Layer } from "effect"
import path from "path"
import { Location } from "../location.js"
import { LocationServiceMap } from "../location-service-map.js"
import { Project } from "../project.js"
import { AbsolutePath, RelativePath } from "../schema.js"
import { DestinationNotDirectoryError, DestinationNotFoundError, DestinationUnavailableError } from "./move.js"

export interface Interface {
  /** Resolves an existing directory relative to `from`, expanding `~`. */
  readonly directory: (input: {
    from: AbsolutePath
    directory: string
  }) => Effect.Effect<AbsolutePath, DestinationNotFoundError | DestinationNotDirectoryError>
  /** Resolves a directory into a usable Session placement. */
  readonly placement: (input: {
    from: AbsolutePath
    directory: string
    workspaceID?: Location.Ref["workspaceID"]
  }) => Effect.Effect<
    SessionFork.Destination,
    DestinationNotFoundError | DestinationNotDirectoryError | DestinationUnavailableError
  >
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SessionDestination") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const global = yield* Global.Service
    const projects = yield* Project.Service
    const locations = yield* LocationServiceMap.Service

    const directory = Effect.fn("SessionDestination.directory")(function* (
      input: Parameters<Interface["directory"]>[0],
    ) {
      const value = input.directory.trim()
      const expanded =
        value === "~" ? global.home : value.startsWith("~/") ? path.join(global.home, value.slice(2)) : value
      const resolved = AbsolutePath.make(path.resolve(input.from, expanded))
      const info = yield* fs.stat(resolved).pipe(Effect.orElseSucceed(() => undefined))
      if (!info) return yield* new DestinationNotFoundError({ directory: resolved })
      if (info.type !== "Directory") return yield* new DestinationNotDirectoryError({ directory: resolved })
      return resolved
    })

    return Service.of({
      directory,
      placement: Effect.fn("SessionDestination.placement")(function* (input) {
        const resolved = yield* directory(input)
        const project = yield* projects.resolve(resolved)
        const location = Location.Ref.make({ directory: resolved, workspaceID: input.workspaceID })
        yield* locations.contextEffect(location).pipe(
          Effect.scoped,
          Effect.catchCause((cause) => {
            if (Cause.hasInterruptsOnly(cause))
              return Effect.failCause(Cause.fromReasons<never>(cause.reasons.filter(Cause.isInterruptReason)))
            return Effect.logWarning("session destination unavailable", { directory: resolved, cause }).pipe(
              Effect.andThen(Effect.fail(new DestinationUnavailableError({ directory: resolved }))),
            )
          }),
        )
        return {
          location,
          projectID: project.id,
          subpath: RelativePath.make(path.relative(project.directory, resolved).replaceAll("\\", "/")),
        }
      }),
    })
  }),
)

export const node = makeGlobalNode({
  service: Service,
  layer,
  deps: [FSUtil.node, Global.node, Project.node, LocationServiceMap.node],
})
