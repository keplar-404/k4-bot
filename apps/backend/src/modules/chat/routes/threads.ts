import { Hono } from "hono";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { getOwnedGroup, groupMembers, leadOf } from "../../groups/store";
import { getRequestContext } from "../../../shared/context";
import { validate } from "../../../shared/validate";
import { createThreadSchema } from "../schemas";
import { MODES } from "../modes";
import { setThreadMode } from "../thread-mode";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { userLimit } from "../../../middleware/rate-limit";
import { bot, chatThread } from "../../../db/schema";
import { z } from "zod";

const threads = new Hono<AuthGuardEnv>()
  // List a user's threads, newest first, cursor-paginated by updatedAt.
  .get("/threads", async (c) => {
    const { db } = getRequestContext(c);
    const botId = c.req.query("botId");
    const groupId = c.req.query("groupId");
    const limit = Math.min(Number(c.req.query("limit") ?? "20") || 20, 50);
    const cursor = c.req.query("cursor");

    const rows = await db
      .select()
      .from(chatThread)
      .where(
        and(
          eq(chatThread.userId, c.get("session").user.id),
          // A bot's own chats leave out the group chats it leads.
          groupId ? eq(chatThread.groupId, groupId) : botId ? and(eq(chatThread.botId, botId), isNull(chatThread.groupId)) : undefined,
          cursor ? lt(chatThread.updatedAt, new Date(cursor)) : undefined,
        ),
      )
      .orderBy(desc(chatThread.updatedAt))
      .limit(limit + 1);

    const items = rows.slice(0, limit);
    c.header("Cache-Control", "no-store");
    return c.json({
      threads: items,
      nextCursor: rows.length > limit ? items[items.length - 1]!.updatedAt.toISOString() : null,
    });
  })

  .post("/threads", validate("json", createThreadSchema), async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const data = c.req.valid("json");

    let botId = data.botId;
    if (data.groupId) {
      const group = await getOwnedGroup(db, userId, data.groupId);
      const lead = group ? leadOf(group, await groupMembers(db, group.id)) : null;
      if (!lead) return c.json({ error: "NOT_FOUND", message: "Group not found" }, 404);
      botId = lead.id;
    }
    const [owned] = await db
      .select({ id: bot.id })
      .from(bot)
      .where(and(eq(bot.id, botId!), eq(bot.userId, userId)))
      .limit(1);
    if (!owned) return c.json({ error: "NOT_FOUND", message: "Bot not found" }, 404);

    const [created] = await db
      .insert(chatThread)
      .values({ id: crypto.randomUUID(), botId: owned.id, groupId: data.groupId ?? null, userId, title: data.title ?? "New chat", mode: data.mode ?? "ask" })
      .returning();
    return c.json({ thread: created }, 201);
  })

  .put("/threads/:id/mode", userLimit, validate("param", z.object({ id: z.string().min(1) })), validate("json", z.object({ mode: z.enum(MODES) })), async (c) => {
    const { db, env } = getRequestContext(c);
    const { id } = c.req.valid("param");
    const updated = await setThreadMode(db, env, c.get("session").user.id, id, c.req.valid("json").mode);
    return updated ? c.json({ thread: updated }) : c.json({ error: "NOT_FOUND" }, 404);
  });

export default threads;
