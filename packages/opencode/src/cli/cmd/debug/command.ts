import { EOL } from "os"
import { Effect } from "effect"
import { Command } from "../../../command"
import { effectCmd } from "../../effect-cmd"

export const CommandCommand = effectCmd({
  command: "command",
  describe: "list all available commands",
  builder: (yargs) => yargs,
  handler: Effect.fn("Cli.debug.command")(function* () {
    const command = yield* Command.Service
    const commands = yield* command.list()
    process.stdout.write(JSON.stringify(commands, null, 2) + EOL)
  }),
})
