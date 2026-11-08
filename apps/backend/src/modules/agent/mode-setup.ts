import type { AgentMiddleware, InterruptOnConfig } from "langchain";
import { computerApprovals, fileApprovals, sandboxApprovals } from "./approvals";
import { createHideToolsMiddleware } from "./middleware/hide-tools";
import { createPlanMiddleware } from "./middleware/plan-guard";
import { approvalsFor, planAllows } from "./modes";
import type { BuildAgentOptions } from "./options";
import { createModeSwitch } from "./tools/mode-switch";

/** Names of the connected-app (MCP) tools that only read. */
export function readOnlyAppTools(options: BuildAgentOptions): string[] {
  return Object.values(options.apps?.readOnly ?? {}).flatMap((tools) => tools.map((t) => t.name));
}

/**
 * Everything the permission mode changes in one run: which tools pause for approval, and which are offered.
 *
 * The mode-switch tool is always registered but only offered in Plan mode. A run that paused on it resumes in a
 * new slice, possibly in another mode, and the tool must still exist then for the resume to work.
 */
export function modeSetup(options: BuildAgentOptions, accountApprovals: Record<string, InterruptOnConfig>) {
  const mode = options.mode ?? "ask";
  const readOnlyApps = readOnlyAppTools(options);

  // Everything that pauses for approval in Ask mode; Allow all and Plan narrow it (modes.ts).
  const askFirst = {
    ...(options.computer ? computerApprovals : fileApprovals),
    ...(options.sandbox ? sandboxApprovals : {}),
    ...options.apps?.approvals,
    ...accountApprovals,
  };

  const middleware: AgentMiddleware[] =
    mode === "plan"
      ? [createPlanMiddleware((name) => planAllows(name, readOnlyApps))]
      : [createHideToolsMiddleware(["request_mode_switch"], "HideModeSwitch")];

  return {
    mode,
    readOnlyApps,
    tools: [createModeSwitch(options.readMode ?? (async () => mode))],
    approvals: approvalsFor(mode, askFirst),
    middleware,
  };
}
