export * as CustomPlugins from "./index.js"

import { CustomAutoLoadSkillsPlugin } from "./auto-load-skills.js"
import { CustomContextPlugin } from "./context.js"
import { CustomDisableSessionMovePlugin } from "./disable-session-move.js"
import { CustomPullRequestsPlugin } from "./pull-requests.js"
import { CustomRetitlePlugin } from "./retitle.js"
import { CustomTaskResumePlugin } from "./task-resume.js"
import { CustomTimeoutsPlugin } from "./timeouts.js"

export const Plugins = [
  CustomAutoLoadSkillsPlugin.Plugin,
  CustomTaskResumePlugin.Plugin,
  CustomRetitlePlugin.Plugin,
  CustomTimeoutsPlugin.Plugin,
  CustomContextPlugin.Plugin,
  CustomPullRequestsPlugin.Plugin,
  CustomDisableSessionMovePlugin.Plugin,
] as const
