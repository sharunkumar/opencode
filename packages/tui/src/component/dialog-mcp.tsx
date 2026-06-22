import { createMemo, createSignal } from "solid-js"
import { useSync } from "../context/sync"
import { map, pipe, entries, sortBy } from "remeda"
import { DialogSelect, type DialogSelectRef, type DialogSelectOption } from "../ui/dialog-select"
import { useTheme } from "../context/theme"
import { TextAttributes } from "@opentui/core"
import { useSDK } from "../context/sdk"

function Status(props: { enabled: boolean; loading: boolean }) {
  const { theme } = useTheme()
  if (props.loading) {
    return <span style={{ fg: theme.textMuted }}>⋯ Connecting</span>
  }
  if (props.enabled) {
    return <span style={{ fg: theme.success, attributes: TextAttributes.BOLD }}>✓ Enabled</span>
  }
  return <span style={{ fg: theme.textMuted }}>○ Disabled</span>
}

export function DialogMcp() {
  const sync = useSync()
  const sdk = useSDK()
  const [, setRef] = createSignal<DialogSelectRef<unknown>>()

  const options = createMemo(() =>
    pipe(
      sync.data.mcp ?? {},
      entries(),
      sortBy(([name]) => name),
      map(([name, status]) => ({
        value: name,
        title: name,
        description: status.status === "failed" ? "failed" : status.status,
        footer: <Status enabled={status.status === "connected"} loading={status.status === "connecting"} />,
        category: undefined,
      })),
    ),
  )

  const actions = createMemo(() => [
    {
      command: "dialog.mcp.toggle",
      title: "toggle",
      onTrigger: async (option: DialogSelectOption<string>) => {
        const current = sync.data.mcp[option.value]
        if (current?.status === "connecting") return
        const action =
          current?.status === "connected"
            ? () => sdk.client.mcp.disconnect({ name: option.value })
            : () => sdk.client.mcp.connect({ name: option.value })
        sync.set("mcp", option.value, {
          status: current?.status === "connected" ? "disabled" : "connecting",
        })
        await action().catch((error) => console.error("Failed to toggle MCP:", error))
        const fresh = await sdk.client.mcp
          .status()
          .catch((error) => (console.error("Failed to refresh MCP status:", error), undefined))
        if (fresh?.data) sync.set("mcp", fresh.data)
      },
    },
  ])

  return (
    <DialogSelect
      ref={setRef}
      title="MCPs"
      options={options()}
      actions={actions()}
      onSelect={(_option) => {
        // Don't close on select, only on escape
      }}
    />
  )
}
