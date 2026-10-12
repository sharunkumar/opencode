import { expect, test } from "bun:test"
import { TuiKeybind } from "../src/config/keybind"

test("binds agent cycling to tab by default", () => {
  expect(TuiKeybind.Definitions["agent.cycle"].default).toBe("tab")
  expect(TuiKeybind.Definitions["agent.cycle.reverse"].default).toBe("shift+tab")
})
