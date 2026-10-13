export * as CustomContext from "./custom-context.js"

import { Schema } from "effect"
import { Rpc } from "./rpc.js"
import { Session } from "./session.js"

const Input = Schema.toStandardSchemaV1(Schema.Struct({ sessionID: Session.ID }))
const Output = Schema.toStandardSchemaV1(
  Schema.Struct({ files: Schema.Array(Schema.String), unavailable: Schema.Boolean }),
)

export const Contract = Rpc.define({
  id: "custom-context",
  methods: {
    list: { input: Input, output: Output },
  },
  events: {},
})
