import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { parseEnv, type Env } from "../../config/env";
import { createDb } from "../../db";
import { runDueTasks } from "../tasks/due";
import { runDueSchedules } from "../workflows/engine/schedule";

/**
 * The per-minute tick, as a native Workflow schedule (wrangler: schedules on the binding) instead of a
 * Worker Cron Trigger. Each firing is an instance, so a slow tick never overlaps the next one, and a
 * missed firing is visible in the Workflow instance history.
 */
export class ScheduleTickWorkflow extends WorkflowEntrypoint<Env, Record<string, never>> {
  async run(event: WorkflowEvent<Record<string, never>>, step: WorkflowStep) {
    const env = parseEnv(this.env);
    const db = createDb(env.DATABASE_URL);
    await step.do("due", async () => {
      const [schedules, tasks] = await Promise.allSettled([runDueSchedules(env, db), runDueTasks(env, db)]);
      if (schedules.status === "rejected") console.error("[schedule] tick failed", schedules.reason);
      if (tasks.status === "rejected") console.error("[tasks] tick failed", tasks.reason);
      return { cron: event.schedule?.cron ?? null, at: event.schedule?.scheduledTime ?? null };
    });
    return { ok: true };
  }
}
