import { tool } from "langchain";
import { z } from "zod";
import type { Env } from "../../config/env";
import { registryFor } from "./registry-stub";
import type { TaskRow } from "./registry";

/** Background tasks one chat may have running at once. */
export const MAX_RUNNING = 6;

export type AsyncToolOptions = { env: Env; threadId: string; userId: string; botName: string; modelId?: string };

const line = (t: TaskRow) => `- ${t.id} "${t.agent}": ${t.status} (started ${new Date(t.created_at).toISOString()}) — ${t.description.slice(0, 120)}`;

/**
 * Deep Agents' five async sub-agent tools, run on this app's own Workflows and a Durable Object registry (no Agent
 * Protocol server). Each task is its own AsyncTaskWorkflow; ids are kept by the registry, not only in messages.
 */
export function createAsyncTaskTools(o: AsyncToolOptions) {
  const registry = () => registryFor(o.env, o.threadId);
  const launch = async (id: string, agent: string, description: string) => {
    const instance = `${id}-${Date.now()}`;
    await o.env.ASYNC_TASK.create({ id: instance, params: { taskId: id, threadId: o.threadId, userId: o.userId, botName: o.botName, agent, description, modelId: o.modelId } });
    return instance;
  };

  const start = tool(
    async ({ agent, description }) => {
      if ((await registry().running()) >= MAX_RUNNING) return `NOT DONE: ${MAX_RUNNING} background tasks are already running here. Wait for one, or cancel one.`;
      const id = `task_${crypto.randomUUID().slice(0, 8)}`;
      await registry().create({ id, agent, description, instance: await launch(id, agent, description) });
      return `Started background task ${id} ("${agent}"). It runs on its own; tell the user it started and carry on. Do NOT check it right away: you will be told when it ends.`;
    },
    {
      name: "start_background_task",
      description: "Start a long task in the BACKGROUND (research, analysis, drafting) and return at once, so you can keep talking with the user. It cannot ask the user anything. Give a complete, self-contained description.",
      schema: z.object({ agent: z.string().min(1).max(40).describe("A short role name, e.g. 'researcher'."), description: z.string().min(10).max(8000).describe("Everything the task needs to know: goal, scope, what to return.") }),
    },
  );
  const check = tool(
    async ({ task_id }) => {
      const t = await registry().get(task_id);
      if (!t) return "NOT DONE: no such task here. Call list_background_tasks for the full ids.";
      return t.status === "running" ? `${task_id} is still running.` : `${task_id} ${t.status}:\n${t.result ?? ""}`;
    },
    { name: "check_background_task", description: "Status and (when finished) the result of a background task. Statuses in older messages may be stale: check before reporting.", schema: z.object({ task_id: z.string().describe("The full task id, never shortened.") }) },
  );
  const update = tool(
    async ({ task_id, message }) => {
      const t = await registry().get(task_id);
      if (!t) return "NOT DONE: no such task here.";
      if (t.status === "running") {
        await registry().push(task_id, message);
        return `Sent to ${task_id}; it reads it before its next step.`;
      }
      await registry().restart(task_id, await launch(task_id, t.agent, `${t.description}\n\nPrevious result:\n${t.result ?? "(none)"}\n\nNew instructions:\n${message}`));
      return `${task_id} had ended; it was started again with your new instructions.`;
    },
    { name: "update_background_task", description: "Send new instructions to a background task (a running one gets them before its next step; an ended one starts again with them).", schema: z.object({ task_id: z.string(), message: z.string().min(1).max(4000) }) },
  );
  const cancel = tool(
    async ({ task_id }) => {
      const t = await registry().get(task_id);
      if (!t) return "NOT DONE: no such task here.";
      if (t.status !== "running") return `${task_id} already ${t.status}.`;
      await registry().finish(task_id, "cancelled", "Cancelled by the lead.");
      await (await o.env.ASYNC_TASK.get(t.instance)).terminate().catch(() => undefined);
      return `Cancelled ${task_id}.`;
    },
    { name: "cancel_background_task", description: "Stop a running background task.", schema: z.object({ task_id: z.string() }) },
  );
  const list = tool(async () => (await registry().list()).map(line).join("\n") || "No background tasks in this chat.", {
    name: "list_background_tasks",
    description: "All background tasks of this chat with their live status.",
    schema: z.object({}),
  });
  return [start, check, update, cancel, list];
}
