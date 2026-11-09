import { tool } from "langchain";
import { z } from "zod";
import type { Db } from "../../../db";
import { SCHEDULE_HELP } from "../../../prompts/tasks";
import { scheduleConfig } from "../../schedules/config";
import { createTask, deleteTask, getTask, listTasks, updateTask } from "../../tasks/store";


const brief = (t: { id: string; title: string; status: string; schedule: unknown; nextRunAt: Date | null; lastError: string | null }) => ({
  id: t.id,
  title: t.title,
  status: t.status,
  schedule: t.schedule,
  nextRunAt: t.nextRunAt?.toISOString() ?? null,
  lastError: t.lastError,
});

/**
 * Scheduled tasks for this bot (like Grok's Tasks): at each due time the bot gets the prompt as a new message in the
 * chat with the user, with all its tools. Creating and deleting ask the user first in Ask mode (account-tools.ts).
 */
export function createTaskTools({ db, userId, botId }: { db: Db; userId: string; botId: string }) {
  const schedule = tool(
    async ({ title, prompt, schedule: when }) => {
      const result = await createTask(db, userId, botId, { title, prompt, schedule: when }, true);
      if ("error" in result) return `NOT DONE: ${result.error}`;
      return `Scheduled. ${JSON.stringify(brief(result.task))} The user can see and edit it on the Tasks page.`;
    },
    {
      name: "schedule_task",
      description: `Schedule a task for yourself: at each time, you get \`prompt\` as a new message in this chat and do it with all your tools (search, apps, workflows). Write the prompt as the full instruction you will need then (older messages may have been summarized by then). ${SCHEDULE_HELP}`,
      schema: z.object({
        title: z.string().trim().min(1).max(80),
        prompt: z.string().trim().min(1).max(4000),
        schedule: scheduleConfig,
      }),
    },
  );

  const list = tool(async () => JSON.stringify((await listTasks(db, userId, botId)).map(brief)), {
    name: "list_scheduled_tasks",
    description: "List your scheduled tasks: id, title, schedule, status, next run and the last problem.",
    schema: z.object({}),
  });

  const change = tool(
    async ({ id, action, schedule: when }) => {
      const task = await getTask(db, userId, id);
      if (!task || task.botId !== botId) return "NOT DONE: no such task of yours.";
      if (action === "delete") return (await deleteTask(db, userId, id)) ? "Deleted." : "NOT DONE: no such task.";
      const status = action === "pause" ? "paused" : action === "resume" ? "active" : undefined;
      const result = await updateTask(db, userId, id, { status, schedule: when });
      return "error" in result ? `NOT DONE: ${result.error}` : `Done. ${JSON.stringify(brief(result.task))}`;
    },
    {
      name: "change_scheduled_task",
      description: `Pause, resume, delete or reschedule one of your scheduled tasks (reschedule: pass the new schedule). ${SCHEDULE_HELP}`,
      schema: z.object({
        id: z.string(),
        action: z.enum(["pause", "resume", "delete", "reschedule"]),
        schedule: scheduleConfig.optional(),
      }),
    },
  );

  return [schedule, list, change];
}
