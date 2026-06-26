export * as LegacyEvent from "./legacy-event"

import { Schema } from "effect"
import { define, inventory } from "../event"
import { SessionID } from "../session-id"
import { SessionV1 } from "./session"

export const CommandExecuted = define({
  type: "command.executed",
  schema: {
    name: Schema.String,
    sessionID: SessionID,
    arguments: Schema.String,
    messageID: SessionV1.MessageID,
  },
})

// Emitted when the command list changes after initial materialization, e.g.
// once MCP prompt commands finish loading in the background. Clients refetch.
export const CommandChanged = define({
  type: "command.changed",
  schema: {},
})

export const Definitions = inventory(CommandExecuted, CommandChanged)
