import z from "zod"

export namespace ConfigSkills {
  export const Info = z.object({
    paths: z.array(z.string()).optional().describe("Additional paths to skill folders"),
    urls: z
      .array(z.string())
      .optional()
      .describe("URLs to fetch skills from (e.g., https://example.com/.well-known/skills/)"),
    slash: z.boolean().optional().describe("Show individual skills as slash commands in autocomplete (default: false)"),
    inline: z
      .boolean()
      .optional()
      .describe("Inline full skill content into prompt on slash command invocation (default: true)"),
  })

  export type Info = z.infer<typeof Info>
}
