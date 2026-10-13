export * as CustomPlugins from "./index.js"

import { CustomAutoLoadSkillsPlugin } from "./auto-load-skills.js"
import { CustomInstructionsPlugin } from "./instructions.js"
import { CustomRetitlePlugin } from "./retitle.js"
import { CustomTaskResumePlugin } from "./task-resume.js"
import { CustomTimeoutsPlugin } from "./timeouts.js"

export const Plugins = [
  CustomAutoLoadSkillsPlugin.Plugin,
  CustomTaskResumePlugin.Plugin,
  CustomRetitlePlugin.Plugin,
  CustomTimeoutsPlugin.Plugin,
  CustomInstructionsPlugin.Plugin,
] as const
