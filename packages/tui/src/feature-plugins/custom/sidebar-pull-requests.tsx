import { Plugin } from "@opencode/plugin/tui"
import { CustomPullRequests } from "@opencode/schema/custom-pull-requests"
import { createMemo, createResource, For, Show } from "solid-js"
import { Link } from "../../ui/link"

export function SidebarPullRequests(props: { context: Plugin.Context; sessionID: string }) {
  const [view, updateView] = props.context.storage.store("view", { initial: { open: true } })
  const theme = props.context.theme
  const session = createMemo(() => props.context.data.session.get(props.sessionID))
  const directory = createMemo(() => (session()?.location ?? props.context.location)?.directory)
  // Tool output updates in place, so the idle marker that closes each turn is what surfaces new links.
  const revision = createMemo(() => props.context.data.session.message.list(props.sessionID)?.length ?? 0)
  const [result] = createResource(
    () => ({ sessionID: props.sessionID, directory: directory(), revision: revision() }),
    (source) =>
      props.context.client
        .rpc(CustomPullRequests.Contract)
        .list({ sessionID: source.sessionID }, { location: { directory: source.directory } })
        .catch(() => undefined),
  )
  const items = createMemo(() => result()?.pullRequests ?? [])

  return (
    <Show when={items().length > 0}>
      <box>
        <box
          flexDirection="row"
          gap={1}
          onMouseDown={() => {
            if (items().length <= 2) return
            void updateView((draft) => {
              draft.open = !draft.open
            }).catch((error) => console.error("Failed to persist pull requests sidebar state", error))
          }}
        >
          <Show when={items().length > 2}>
            <text fg={theme.text.base}>{view.open ? "▼" : "▶"}</text>
          </Show>
          <text fg={theme.text.base}>
            <b>Pull Requests</b>
            <Show when={items().length > 2 && !view.open}>
              <span style={{ fg: theme.text.muted }}> ({items().length})</span>
            </Show>
          </text>
        </box>
        <Show when={items().length <= 2 || view.open}>
          <For each={items()}>
            {(item) => (
              <Link href={item.url} fg={theme.text.muted} wrapMode="none">
                {item.label}
              </Link>
            )}
          </For>
        </Show>
      </box>
    </Show>
  )
}

export default Plugin.define({
  id: "custom.sidebar.pull-requests",
  setup(context) {
    context.ui.slot({
      append: "sidebar.content",
      render: (props) => <SidebarPullRequests context={context} sessionID={props.sessionID} />,
    })
  },
})
