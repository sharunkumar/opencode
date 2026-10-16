import { Plugin } from "@opencode/plugin/tui"
import { CustomAutoLoadSkills } from "@opencode/schema/custom-auto-load-skills"
import { CustomContext } from "@opencode/schema/custom-context"
import { createMemo, createResource, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useClipboard } from "../../context/clipboard"
import { useToast } from "../../ui/toast"

type Node = { label: string; children?: readonly Node[] }

function Tree(props: { context: Plugin.Context; nodes: readonly Node[]; prefix: string }) {
  const theme = props.context.theme

  return (
    <For each={props.nodes}>
      {(node, index) => {
        const last = () => index() === props.nodes.length - 1
        return (
          <>
            <text fg={theme.text.muted} wrapMode="none" truncate>
              {props.prefix}
              {last() ? "└─ " : "├─ "}
              <span style={{ fg: node.children ? theme.text.base : theme.text.muted }}>{node.label}</span>
            </text>
            <Show when={node.children}>
              {(children) => (
                <Tree context={props.context} nodes={children()} prefix={props.prefix + (last() ? "   " : "│  ")} />
              )}
            </Show>
          </>
        )
      }}
    </For>
  )
}

const group = (label: string, items: readonly string[]): Node[] =>
  items.length > 0 ? [{ label, children: items.map((item) => ({ label: item })) }] : []

export function SidebarContext(props: { context: Plugin.Context; sessionID: string }) {
  const theme = props.context.theme
  const session = createMemo(() => props.context.data.session.get(props.sessionID))
  const directory = createMemo(() => (session()?.location ?? props.context.location)?.directory)
  const roots = createMemo(() => (session()?.roots ?? []).join("\0"))
  const clipboard = useClipboard()
  const toast = useToast()
  const [open, setOpen] = createStore<Record<string, boolean>>({})
  // Edited instructions, nested loads, and skill loads land in the transcript as system, synthetic, user, or
  // skill messages, or as a completed skill tool call inside an assistant message that already exists.
  const revision = createMemo(() =>
    (props.context.data.session.message.list(props.sessionID) ?? []).reduce((count, message) => {
      if (message.type === "assistant")
        return (
          count +
          message.content.filter(
            (part) => part.type === "tool" && part.name === "skill" && part.state.status === "completed",
          ).length
        )
      return message.type === "user" ||
        message.type === "skill" ||
        message.type === "synthetic" ||
        message.type === "system" ||
        message.type === "compaction"
        ? count + 1
        : count
    }, 0),
  )
  const [result] = createResource(
    () => ({ sessionID: props.sessionID, directory: directory(), revision: revision(), roots: roots() }),
    (source) => {
      const input = { sessionID: source.sessionID }
      const options = { location: { directory: source.directory } }
      return Promise.all([
        props.context.client.rpc(CustomContext.Contract).list(input, options),
        props.context.client
          .rpc(CustomAutoLoadSkills.Contract)
          .list(input, options)
          .catch(() => ({ skills: [] })),
      ])
        .then(([context, autoLoaded]) => ({
          ...context,
          skills: [...new Set([...autoLoaded.skills, ...context.skills])],
        }))
        .catch(() => undefined)
    },
  )
  const nodes = createMemo(() => [
    ...group("Instructions", result()?.files ?? []),
    ...group("Skills", result()?.skills ?? []),
  ])
  const rootNodes = createMemo(() =>
    (result()?.roots ?? []).map((root) => ({
      path: root.path,
      label: root.directory,
      children: [...group("Instructions", root.files), ...group("Skills", root.skills)],
    })),
  )

  return (
    <Show when={nodes().length > 0 || rootNodes().length > 0}>
      <box>
        <text fg={theme.text.base}>
          <b>Context</b>
        </text>
        <Tree context={props.context} nodes={nodes()} prefix="" />
        <For each={rootNodes()}>
          {(root) => (
            <>
              <box
                onMouseDown={() => {
                  setOpen(root.path, !open[root.path])
                  void clipboard.write(root.path).then(
                    () => toast.show({ message: "Path copied to clipboard", variant: "info" }),
                    toast.error,
                  )
                }}
              >
                <text fg={theme.text.base} wrapMode="none" selectable={false} truncate>
                  {root.label}
                </text>
              </box>
              <Show when={open[root.path]}>
                <Tree context={props.context} nodes={root.children} prefix="" />
              </Show>
            </>
          )}
        </For>
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
