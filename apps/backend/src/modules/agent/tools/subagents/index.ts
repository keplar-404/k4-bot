import type { StructuredToolInterface } from "@langchain/core/tools";
import { tool } from "langchain";
import { MAX_SUBAGENTS } from "../../domains/types";
import { LEAD } from "./group";
import type { SubagentToolsOptions } from "./options";
import { createCollect, waitLead } from "./results";
import { messageSchema, spawnDescription, spawnSchema, waitSchema } from "./schemas";
import { startGroup } from "./start";

export { GroupHub } from "./hub";
export type { SubagentToolsOptions } from "./options";
export { collectUnfinished } from "./results";

const callId = (config: unknown) => (config as { toolCall?: { id?: string } } | undefined)?.toolCall?.id;

/**
 * The sub-agent tools of a bot with the capability: spawn_subagents, wait_for_subagents, message_subagents.
 *
 * A group's members run in parallel, each with its own clean context, its own files, the group's /shared/ folder,
 * web tools, and exactly the skills and apps the lead assigns (from everything the user installed). Members talk to
 * the lead and to each other (send_message, ask_lead). The lead waits in spawn/wait_for_subagents and is woken as
 * soon as a member writes to it. When the group finishes, every member's files are saved in the lead's workspace
 * (subagents/<group>/<member>/, plus shared/), the reports go back to the lead, and the group is removed.
 *
 * Members never get the computer, cannot ask the user, cannot spawn sub-agents, and only get an app's read-only
 * tools: anything that changes the user's data stays with the lead, where the chat asks for approval.
 */
export function createSubagentTools(o: SubagentToolsOptions): StructuredToolInterface[] {
  const max = Math.min(Math.max(1, o.maxAgents), MAX_SUBAGENTS);
  const collect = createCollect(o);

  const spawn = tool(
    async ({ goal, agents }, config) => {
      const g = await startGroup(o, max, goal, agents, callId(config) ?? "");
      return typeof g === "string" ? g : waitLead(g, collect);
    },
    { name: "spawn_subagents", description: spawnDescription(o, max), schema: spawnSchema(max) },
  );

  const wait = tool(
    async ({ group_id }, config) => {
      const g = o.hub.groups.get(group_id);
      if (!g) return `No running group "${group_id}". Its results were already returned to you.`;
      // The live status now shows under this call.
      g.watcher = callId(config) ?? g.watcher;
      await o.report?.(g.watcher, g.statuses.map((s) => ({ ...s }))).catch(() => undefined);
      return waitLead(g, collect);
    },
    {
      name: "wait_for_subagents",
      description: "Keep waiting for a running sub-agent group: returns when it finishes (with every report) or when a member messages you.",
      schema: waitSchema,
    },
  );

  const message = tool(
    ({ group_id, to, text }) => {
      const g = o.hub.groups.get(group_id);
      if (!g) return `No running group "${group_id}".`;
      const error = g.post(LEAD, to, text);
      return error ? `NOT SENT: ${error}` : `Sent to ${to}. Call wait_for_subagents with group_id "${group_id}" to keep waiting.`;
    },
    {
      name: "message_subagents",
      description: 'Send a message to one sub-agent of a running group (by name) or to all of them ("all"): an answer to its question, new instructions, or data it needs.',
      schema: messageSchema,
    },
  );

  o.hub.collect = collect;
  return [spawn, wait, message];
}
