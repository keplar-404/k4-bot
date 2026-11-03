import { z } from "zod";
import type { SubagentToolsOptions } from "./options";

/** What the lead reads about spawn_subagents: what a group can do, and which skills and apps it may hand out. */
export function spawnDescription(o: SubagentToolsOptions, max: number): string {
  const skillList = o.installedSkills.map((s) => `${s.name} (${s.description.slice(0, 90)})`).join("; ");
  const appList = o.connectedApps.map((a) => `${a.serverId} (${a.name})`).join(", ");
  return (
    `Run a group of up to ${max} sub-agents in parallel, each on one independent part of the job. ` +
    "Each starts with a clean context (the shared goal, its own task, any background you give), has web search and page reading, its own files, " +
    "and a /shared/ folder with the group; members can message you and each other. " +
    "This call waits until the group finishes, or returns early when a member messages you (answer with message_subagents, then call wait_for_subagents). " +
    "When it finishes you get every report, and every member's files are saved in your workspace under subagents/<group>/. " +
    "Use it for broad work with separate parts (subtopics, entities, regions, sources), not for a single question. " +
    `Skills you can give them (by name): ${skillList || "none installed"}. Apps you can give them (read-only, by id): ${appList || "none connected"}.`
  );
}

export const spawnSchema = (max: number) =>
  z.object({
    goal: z.string().min(10).max(4000).describe("The overall question and the user's limits (dates, places, scope), shared with every sub-agent."),
    agents: z
      .array(
        z.object({
          name: z.string().regex(/^[a-z0-9-]{2,40}$/, "lowercase letters, digits and hyphens").describe("Short id, e.g. 'pricing-europe'."),
          task: z.string().min(10).max(4000).describe("What this sub-agent must find or do: its key questions and what is out of scope."),
          context: z.string().max(8000).optional().describe("Background it needs: findings so far, sources to start from, definitions."),
          skills: z.array(z.string().max(80)).max(10).optional().describe("Names of installed skills to give it."),
          apps: z.array(z.string().max(40)).max(5).optional().describe("Ids of connected apps to give it (read-only tools)."),
        }),
      )
      .min(1)
      .max(max),
  });

export const waitSchema = z.object({ group_id: z.string().min(2).max(20) });

export const messageSchema = z.object({ group_id: z.string().min(2).max(20), to: z.string().min(1).max(40), text: z.string().min(1).max(8000) });
