import { Plugin } from "@opencode/plugin/tui"
import { CustomContext } from "@opencode/schema/custom-context"
import { createMemo, createResource, For, Show } from "solid-js"

export function SidebarContext(props: { context: Plugin.Context; sessionID: string }) {
  const [view, updateView] = props.context.storage.store("view", { initial: { open: true } })
  const theme = props.context.theme
  const session = createMemo(() => props.context.data.session.get(props.sessionID))
  const directory = createMemo(() => (session()?.location ?? props.context.location)?.directory)
  // Edited context files and nested loads both land in the transcript as system or synthetic messages.
  const revision = createMemo(
    () =>
      (props.context.data.session.message.list(props.sessionID) ?? []).filter(
        (message) => message.type === "synthetic" || message.type === "system",
      ).length,
  )
  const [result] = createResource(
    () => ({ sessionID: props.sessionID, directory: directory(), revision: revision() }),
    (source) =>
      props.context.client
        .rpc(CustomContext.Contract)
        .list({ sessionID: source.sessionID }, { location: { directory: source.directory } })
        .catch(() => undefined),
  )
  const files = createMemo(() => result()?.files ?? [])

  return (
    <Show when={files().length > 0}>
      <box>
        <box
          flexDirection="row"
          gap={1}
          onMouseDown={() => {
            if (files().length <= 2) return
            void updateView((draft) => {
              draft.open = !draft.open
            }).catch((error) => console.error("Failed to persist context sidebar state", error))
          }}
        >
          <Show when={files().length > 2}>
            <text fg={theme.text.base}>{view.open ? "▼" : "▶"}</text>
          </Show>
          <text fg={theme.text.base}>
            <b>Context</b>
            <Show when={files().length > 2 && !view.open}>
              <span style={{ fg: theme.text.muted }}> ({files().length})</span>
            </Show>
          </text>
        </box>
        <Show when={files().length <= 2 || view.open}>
          <For each={files()}>
            {(file) => (
              <text fg={theme.text.muted} wrapMode="none" truncate>
                {file}
              </text>
            )}
          </For>
        </Show>
      </box>
    </Show>
  )
}

export default Plugin.define({
  id: "custom.sidebar.context",
  setup(context) {
    context.ui.slot({
      append: "sidebar.content",
      render: (props) => <SidebarContext context={context} sessionID={props.sessionID} />,
    })
  },
})
