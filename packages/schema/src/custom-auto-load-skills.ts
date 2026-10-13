export * as CustomAutoLoadSkills from "./custom-auto-load-skills.js"

import { Schema } from "effect"
import { Rpc } from "./rpc.js"
import { Session } from "./session.js"

const Input = Schema.toStandardSchemaV1(Schema.Struct({ sessionID: Session.ID }))
const Output = Schema.toStandardSchemaV1(Schema.Struct({ skills: Schema.Array(Schema.String) }))

export const Contract = Rpc.define({
  id: "custom-auto-load-skills",
  methods: {
    list: { input: Input, output: Output },
  },
  events: {},
})
