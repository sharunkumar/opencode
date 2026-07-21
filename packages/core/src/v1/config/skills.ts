export * as ConfigSkillsV1 from "./skills"

import { Schema } from "effect"

export const Info = Schema.Struct({
  paths: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "Additional paths to skill folders",
  }),
  urls: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "URLs to fetch skills from (e.g., https://example.com/.well-known/skills/)",
  }),
  slash: Schema.optional(Schema.Boolean).annotate({
    description: "Show individual skills as slash commands in autocomplete (default: true)",
  }),
  inline: Schema.optional(Schema.Boolean).annotate({
    description: "Inline full skill content into prompt on slash command invocation (default: false)",
  }),
  auto_load: Schema.optional(Schema.Array(Schema.String)).annotate({
    description:
      "Skill names to load automatically into the main session system prompt. These skills are omitted from the available skills list.",
  }),
})
export type Info = Schema.Schema.Type<typeof Info>
