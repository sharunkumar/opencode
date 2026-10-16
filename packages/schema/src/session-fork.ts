export * as SessionFork from "./session-fork.js"

import { Schema } from "effect"
import { Location } from "./location.js"
import { Project } from "./project.js"
import { optional, RelativePath } from "./schema.js"
import { SessionMessage } from "./session-message.js"

export const Boundary = Schema.Union([
  Schema.Struct({ type: Schema.Literal("before"), messageID: SessionMessage.ID }),
  Schema.Struct({ type: Schema.Literal("through"), messageID: SessionMessage.ID }),
]).annotate({ identifier: "Session.ForkBoundary" })
export type Boundary = typeof Boundary.Type

export interface Destination extends Schema.Schema.Type<typeof Destination> {}
export const Destination = Schema.Struct({
  location: Location.Ref,
  projectID: Project.ID,
  subpath: RelativePath.pipe(optional),
}).annotate({ identifier: "Session.ForkDestination" })
