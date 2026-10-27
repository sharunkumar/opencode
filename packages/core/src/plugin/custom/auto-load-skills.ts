export * as CustomAutoLoadSkillsPlugin from "./auto-load-skills.js"

import { SystemPart } from "@opencode/ai/effect"
import { define } from "@opencode/plugin/effect/plugin"
import type { SessionHooks } from "@opencode/plugin/effect/session"
import { CustomAutoLoadSkills } from "@opencode/schema/custom-auto-load-skills"
import { Effect, Option, Schema } from "effect"

const Options = Schema.Struct({ skills: Schema.Array(Schema.String) })

export function names(options: unknown) {
  const configured = Option.getOrUndefined(Schema.decodeUnknownOption(Options)(options))
  return (configured?.skills ?? []).map((item) => item.trim().toLowerCase()).filter((item) => item !== "")
}

export const Plugin = define({
  id: "custom.skills.auto-load",
  effect: Effect.fn("CustomAutoLoadSkillsPlugin")(function* (ctx) {
    const selection = names(ctx.options)
    const selected = <T extends { readonly id: string; readonly name: string }>(skill: T) =>
      selection.includes(skill.id.toLowerCase()) || selection.includes(skill.name.toLowerCase())

    // Backs the TUI context sidebar; registered even when nothing is configured so the call never fails.
    yield* ctx.rpc
      .register(CustomAutoLoadSkills.Contract, {
        list: (input) =>
          Effect.gen(function* () {
            const session = yield* ctx.session.get({ sessionID: input.sessionID })
            if (session.parentID) return { skills: [] }
            return { skills: (yield* ctx.skill.list()).data.filter(selected).map((skill) => skill.name) }
          }).pipe(Effect.orDie),
      })
      .pipe(Effect.orDie)

    if (selection.length === 0) return

    yield* ctx.skill.transform((editor) => {
      editor
        .list()
        .filter(selected)
        .forEach((skill) =>
          editor.update(skill.id, (item) => {
            item.autoinvoke = false
          }),
        )
    })

    const hook = (event: SessionHooks["context"]) =>
      Effect.gen(function* () {
        const session = yield* ctx.session.get({ sessionID: event.sessionID })
        if (session.parentID) return
        const skills = (yield* ctx.skill.list()).data.filter(selected)
        skills.forEach((skill) =>
          event.system.push(
            SystemPart.make(`<skill_content name="${skill.name}">\n${skill.content}\n</skill_content>`),
          ),
        )
      }).pipe(Effect.catch(() => Effect.void))
    yield* ctx.session.hook("context", hook)
    yield* ctx.session.hook("compaction", hook)
  }),
})
