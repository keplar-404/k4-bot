import { Hono } from "hono";
import { z } from "zod";
import { authGuard, type AuthGuardEnv } from "../../middleware/auth-guard";
import { userLimit } from "../../middleware/rate-limit";
import { getRequestContext } from "../../shared/context";
import { validate } from "../../shared/validate";
import { looksSecret } from "../memory/auto/validate";
import { and, eq } from "drizzle-orm";
import { chatThread } from "../../db/schema";
import { cleanupThreads } from "../chat/cleanup";
import { createGroup, deleteGroup, getOwnedGroup, listGroups, updateGroup } from "./store";

const idParam = z.object({ id: z.uuid() });
const botIds = z.array(z.string().min(1).max(64)).min(2).max(100);
const name = z.string().trim().min(1).max(60);
const createBody = z.object({ name, botIds, leadBotId: z.string().max(64).optional() });
const patchBody = z.object({ name: name.optional(), botIds: botIds.optional(), leadBotId: z.string().max(64).optional(), memory: z.string().max(4000).optional() });

/** Bot groups (/api/v1/groups): the signed-in user's own only; members are always the user's own bots. */
const groups = new Hono<AuthGuardEnv>()
  .use("*", authGuard)
  .get("/", async (c) => {
    const { db } = getRequestContext(c);
    return c.json({ groups: await listGroups(db, c.get("session").user.id) });
  })
  .post("/", userLimit, validate("json", createBody), async (c) => {
    const { db } = getRequestContext(c);
    const result = await createGroup(db, c.get("session").user.id, c.req.valid("json"));
    if ("error" in result) return c.json({ error: "INVALID_INPUT", message: result.error }, 422);
    return c.json({ group: result.group }, 201);
  })
  .patch("/:id", userLimit, validate("param", idParam), validate("json", patchBody), async (c) => {
    const { db } = getRequestContext(c);
    const body = c.req.valid("json");
    if (body.memory && looksSecret(body.memory)) return c.json({ error: "INVALID_INPUT", message: "Group notes must not hold passwords or keys. Use Secrets." }, 422);
    const result = await updateGroup(db, c.get("session").user.id, c.req.valid("param").id, body);
    if ("error" in result) return result.error === "NOT_FOUND" ? c.json({ error: "NOT_FOUND" }, 404) : c.json({ error: "INVALID_INPUT", message: result.error }, 422);
    return c.json({ group: result.group });
  })
  .delete("/:id", userLimit, validate("param", idParam), async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const id = c.req.valid("param").id;
    if (!(await getOwnedGroup(db, userId, id))) return c.json({ error: "NOT_FOUND" }, 404);
    // Its chats' runs, agent states and live streams go first; the rows go with the database cascade.
    const threads = await db.select({ id: chatThread.id }).from(chatThread).where(and(eq(chatThread.groupId, id), eq(chatThread.userId, userId)));
    await cleanupThreads(db, env, threads.map((t) => t.id));
    const ok = await deleteGroup(db, userId, id);
    return ok ? c.json({ ok: true }) : c.json({ error: "NOT_FOUND" }, 404);
  });

export default groups;
