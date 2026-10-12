import { Plugin } from "@opencode/plugin/tui"
import { CustomTimeouts } from "@opencode/schema/custom-timeouts"

export default Plugin.define({
  id: "custom.timeouts",
  setup(context) {
    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "session.timeouts",
          title: "Toggle default shell timeout",
          group: "Session",
          palette: true,
          slash: { name: "timeouts" },
          async run() {
            const route = context.ui.router.current()
            if (route.type !== "session") {
              context.ui.toast.show({ message: "Open a session first", variant: "warning" })
              return
            }
            await context.client
              .rpc(CustomTimeouts.Contract)
              .toggle({ sessionID: route.sessionID })
              .then((result) =>
                context.ui.toast.show({
                  message: result.enabled ? "Default shell timeout on" : "Default shell timeout off",
                  variant: "info",
                }),
              )
              .catch((cause: unknown) =>
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
