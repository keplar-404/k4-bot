import { Hono } from "hono";
import { z } from "zod";
import { authGuard, type AuthGuardEnv } from "../../middleware/auth-guard";
import { userLimit } from "../../middleware/rate-limit";
import { getRequestContext } from "../../shared/context";
import { validate } from "../../shared/validate";
import { startTask } from "./start";
import { createTask, deleteTask, getTask, listTasks, updateTask } from "./store";

const idParam = z.object({ id: z.uuid() });
const fields = {
  title: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(4000),
  schedule: z.record(z.string(), z.unknown()),
};
const createBody = z.object({ botId: z.string().min(1).max(64), ...fields });
const patchBody = z.object({
  title: fields.title.optional(),
  prompt: fields.prompt.optional(),
  schedule: fields.schedule.optional(),
  status: z.enum(["active", "paused"]).optional(),
});

/** A bot's scheduled tasks (/api/v1/tasks): the signed-in user's own only. */
const tasks = new Hono<AuthGuardEnv>()
  .use("*", authGuard)
  .get("/", validate("query", z.object({ botId: z.string().max(64).optional() })), async (c) => {
    const { db } = getRequestContext(c);
    const items = await listTasks(db, c.get("session").user.id, c.req.valid("query").botId);
    return c.json({ items });
  })
  .post("/", userLimit, validate("json", createBody), async (c) => {
    const { db } = getRequestContext(c);
    const { botId, ...input } = c.req.valid("json");
    const result = await createTask(db, c.get("session").user.id, botId, input);
    if ("error" in result) return c.json({ error: "INVALID_INPUT", message: result.error }, 422);
    return c.json({ task: result.task }, 201);
  })
  .patch("/:id", userLimit, validate("param", idParam), validate("json", patchBody), async (c) => {
    const { db } = getRequestContext(c);
    const result = await updateTask(db, c.get("session").user.id, c.req.valid("param").id, c.req.valid("json"));
    if ("error" in result) return c.json({ error: "INVALID_INPUT", message: result.error }, 422);
    return c.json({ task: result.task });
  })
  // Run it now, outside its schedule (to try it).
  .post("/:id/run", userLimit, validate("param", idParam), async (c) => {
    const { db, env } = getRequestContext(c);
    const task = await getTask(db, c.get("session").user.id, c.req.valid("param").id);
    if (!task) return c.json({ error: "NOT_FOUND", message: "Task not found." }, 404);
    const problem = await startTask(env, db, task);
    if (problem) return c.json({ error: "NOT_STARTED", message: problem }, 409);
    const fresh = await getTask(db, task.userId, task.id);
    return c.json({ threadId: fresh?.threadId ?? null });
  })
  .delete("/:id", validate("param", idParam), async (c) => {
    const { db } = getRequestContext(c);
    const deleted = await deleteTask(db, c.get("session").user.id, c.req.valid("param").id);
    return deleted ? c.json({ ok: true }) : c.json({ error: "NOT_FOUND", message: "Task not found." }, 404);
  });

export default tasks;
