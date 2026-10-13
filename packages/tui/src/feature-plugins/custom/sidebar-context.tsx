import { Plugin } from "@opencode/plugin/tui"
import { CustomAutoLoadSkills } from "@opencode/schema/custom-auto-load-skills"
import { CustomContext } from "@opencode/schema/custom-context"
import { createMemo, createResource, For, Show } from "solid-js"

function Section(props: { context: Plugin.Context; title: string; items: readonly string[]; last: boolean }) {
  const theme = props.context.theme

  return (
    <box>
      <text fg={theme.text.muted} wrapMode="none" truncate>
        {props.last ? "└─ " : "├─ "}
        <span style={{ fg: theme.text.base }}>{props.title}</span>
      </text>
      <For each={props.items}>
        {(item, index) => (
          <text fg={theme.text.muted} wrapMode="none" truncate>
            {props.last ? "   " : "│  "}
            {index() === props.items.length - 1 ? "└─ " : "├─ "}
            {item}
          </text>
        )}
      </For>
    </box>
  )
}

export function SidebarContext(props: { context: Plugin.Context; sessionID: string }) {
  const theme = props.context.theme
  const session = createMemo(() => props.context.data.session.get(props.sessionID))
  const directory = createMemo(() => (session()?.location ?? props.context.location)?.directory)
  // Edited instructions, nested loads, and skill loads land in the transcript as system, synthetic, user, or
  // skill messages, or as a completed skill tool call inside an assistant message that already exists.
  const revision = createMemo(() =>
    (props.context.data.session.message.list(props.sessionID) ?? []).reduce((count, message) => {
      if (message.type === "assistant")
        return count + message.content.filter((part) => part.type === "tool" && part.name === "skill" && part.state.status === "completed").length
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
    () => ({ sessionID: props.sessionID, directory: directory(), revision: revision() }),
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
  const sections = createMemo(() =>
    [
      { title: "Instructions", items: result()?.files ?? [] },
      { title: "Skills", items: result()?.skills ?? [] },
    ].filter((section) => section.items.length > 0),
  )

  return (
    <Show when={sections().length > 0}>
      <box>
        <text fg={theme.text.base}>
          <b>Context</b>
        </text>
        <For each={sections()}>
          {(section, index) => (
            <Section
              context={props.context}
              title={section.title}
              items={section.items}
              last={index() === sections().length - 1}
            />
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
