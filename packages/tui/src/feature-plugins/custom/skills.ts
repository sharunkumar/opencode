import { Plugin } from "@opencode/plugin/tui"

export default Plugin.define({
  id: "custom.skills",
  setup(context) {
    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "session.skills",
          title: "Browse skills",
          group: "Session",
          palette: true,
          slash: { name: "skills" },
          async run() {
            const route = context.ui.router.current()
            if (route.type !== "session") {
              context.ui.toast.show({ message: "Open a session first", variant: "warning" })
              return
            }
            const skills = await context.client.skill.list().then((result) => result.data)
            const selected = await context.ui.dialog.select({
              title: "Skills",
              placeholder: "Search skills",
              options: skills.map((skill) => ({
                title: skill.name,
                value: skill.id,
                description: skill.description,
              })),
            })
            if (!selected) return
            await context.client.session.skill({ sessionID: route.sessionID, id: selected }).catch((cause: unknown) =>
              context.ui.toast.show({
                message: cause instanceof Error ? cause.message : String(cause),
                variant: "error",
              }),
            )
          },
        },
      ],
    }))
  },
})
