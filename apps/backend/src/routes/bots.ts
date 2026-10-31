import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getRequestContext } from "../lib/context";
import { authGuard, type AuthGuardEnv } from "../middleware/auth-guard";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { bot } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createBotSchema } from "../lib/schemas/bot";

const bots = new Hono<AuthGuardEnv>()
  .use("*", authGuard)
  .get("/", async (c) => {
    const { db } = getRequestContext(c);
    const rows = await db
      .select({
        id: bot.id,
        name: bot.name,
        description: bot.description,
        shape: bot.shape,
        color: bot.color,
        expression: bot.expression,
      })
      .from(bot)
      .where(eq(bot.userId, c.get("session").user.id))
      .orderBy(desc(bot.createdAt));
    // No HTTP caching: the client keeps its own TTL cache and must never
    // re-serve a stale list over an optimistic create/update/delete.
    c.header("Cache-Control", "no-store");
    return c.json({ bots: rows });
  })
  .post("/", rateLimitMiddleware({ window: 60, max: 10 }), async (c) => {
    const { db } = getRequestContext(c);
    const parsed = createBotSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json(
        { error: "INVALID_INPUT", details: parsed.error.flatten() },
        400,
      );
    }
    const data = parsed.data;
    const [created] = await db
      .insert(bot)
      .values({
        id: crypto.randomUUID(),
        userId: c.get("session").user.id,
        name: data.name,
        description: data.description,
        shape: data.shape,
        color: data.color,
        expression: data.expression,
      })
      .returning();
    return c.json({ bot: created }, 201);
  })
  .patch(
    "/:id",
    rateLimitMiddleware({ window: 60, max: 10 }),
    zValidator("json", createBotSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          { error: "INVALID_INPUT", details: z.flattenError(result.error) },
          400,
        );
      }
    }),
    async (c) => {
      const { db } = getRequestContext(c);
      const id = c.req.param("id");
      const data = c.req.valid("json");
      const [updated] = await db
        .update(bot)
        .set({
          name: data.name,
          description: data.description,
          shape: data.shape,
          color: data.color,
          expression: data.expression,
        })
        .where(
          and(eq(bot.id, id), eq(bot.userId, c.get("session").user.id)),
        )
        .returning();
      if (!updated) {
        return c.json({ error: "NOT_FOUND", message: "Bot not found" }, 404);
      }
      return c.json({ bot: updated });
    },
  )
  .delete("/:id", async (c) => {
    const { db } = getRequestContext(c);
    const id = c.req.param("id");
    await db
      .delete(bot)
      .where(
        and(eq(bot.id, id), eq(bot.userId, c.get("session").user.id)),
      );
    return c.json({ ok: true });
  });

export default bots;
