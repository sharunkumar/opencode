export * as CustomPullRequests from "./custom-pull-requests.js"

import { Schema } from "effect"
import { Rpc } from "./rpc.js"
import { Session } from "./session.js"

const Input = Schema.toStandardSchemaV1(Schema.Struct({ sessionID: Session.ID }))
const Output = Schema.toStandardSchemaV1(
  Schema.Struct({
    pullRequests: Schema.Array(Schema.Struct({ url: Schema.String, label: Schema.String })),
  }),
)

export const Contract = Rpc.define({
  id: "custom-pull-requests",
  methods: {
    list: { input: Input, output: Output },
  },
  events: {},
})
