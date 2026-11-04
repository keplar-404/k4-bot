import { tokensUsedToday } from "../../../chat/threads";
import { isFreeModel } from "../../models";
import { Group, LEAD } from "./group";
import { GROUP_MAX_MS, type SubagentToolsOptions } from "./options";
import { runGroup } from "./run-group";

export type AgentSpec = { name: string; task: string; context?: string; skills?: string[]; apps?: string[] };

/** Checks the request, then starts the group in the background. Returns it, or the reason it was refused. */
export async function startGroup(o: SubagentToolsOptions, max: number, goal: string, agents: AgentSpec[], toolCallId: string): Promise<Group | string> {
  const skillList = o.installedSkills.map((s) => `${s.name} (${s.description.slice(0, 90)})`).join("; ");
  const appList = o.connectedApps.map((a) => `${a.serverId} (${a.name})`).join(", ");
  if (agents.length > max) return `NOT DONE: this bot may run at most ${max} sub-agents at once.`;
  const names = new Set<string>();
  for (const a of agents) {
    if (a.name === LEAD || a.name === "all") return `NOT DONE: "${a.name}" is reserved; choose another name.`;
    if (names.has(a.name)) return `NOT DONE: two sub-agents are named "${a.name}". Give each a distinct name.`;
    names.add(a.name);
    const badSkill = a.skills?.find((s) => !o.installedSkills.some((i) => i.name === s));
    if (badSkill) return `NOT DONE: no installed skill "${badSkill}". Installed: ${skillList || "none"}.`;
    const badApp = a.apps?.find((s) => !o.connectedApps.some((c) => c.serverId === s));
    if (badApp) return `NOT DONE: no connected app "${badApp}". Connected: ${appList || "none"}.`;
  }
  const groupEnd = Math.min(Date.now() + GROUP_MAX_MS, o.sliceDeadline - 60_000);
  if (groupEnd - Date.now() < 2 * 60_000) return "NOT DONE: too little time is left in this step to run a group. Finish what you have, or continue in your next message.";
  if (!isFreeModel(o.modelId) && (await tokensUsedToday(o.db, o.userId)) >= o.env.MAX_DAILY_TOKENS_PER_USER) return "NOT DONE: today's token budget is used up. Continue on your own or tell the user.";

  const g = new Group(`g${crypto.randomUUID().slice(0, 6)}`, goal, agents.map((a) => a.name));
  g.watcher = toolCallId;
  o.hub.groups.set(g.id, g);
  const publish = () => (o.report && g.watcher ? o.report(g.watcher, g.statuses.map((s) => ({ ...s }))).catch(() => undefined) : undefined);
  await publish();

  g.finished = runGroup(o, g, agents, groupEnd, publish);
  return g;
}
