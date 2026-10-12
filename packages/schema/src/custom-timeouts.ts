export * as CustomTimeouts from "./custom-timeouts.js"

import { Schema } from "effect"
import { Rpc } from "./rpc.js"

const Input = Schema.toStandardSchemaV1(Schema.Struct({ sessionID: Schema.String }))
const Output = Schema.toStandardSchemaV1(Schema.Struct({ enabled: Schema.Boolean }))

export const Contract = Rpc.define({
  id: "custom-timeouts",
  methods: {
    get: { input: Input, output: Output },
    toggle: { input: Input, output: Output },
  },
  events: {},
})
