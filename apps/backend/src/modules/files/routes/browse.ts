import { Hono } from "hono";
import { and, desc, eq, lt } from "drizzle-orm";
import { getRequestContext } from "../../../shared/context";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { userLimit } from "../../../middleware/rate-limit";
import { bot, chatFile } from "../../../db/schema";
import { isInline, ownedFile, toRef } from "..";

const browse = new Hono<AuthGuardEnv>()
  // Newest first, cursor-paginated by createdAt; optionally one bot's files.
  .get("/", async (c) => {
    const { db } = getRequestContext(c);
    const limit = Math.min(Number(c.req.query("limit") ?? "40") || 40, 100);
    const botId = c.req.query("botId");
    const cursor = c.req.query("cursor");
    const rows = await db
      .select({
        id: chatFile.id,
        name: chatFile.name,
        mimeType: chatFile.mimeType,
        size: chatFile.size,
        source: chatFile.source,
        botId: chatFile.botId,
        botName: bot.name,
        threadId: chatFile.threadId,
        computerPath: chatFile.computerPath,
        prompt: chatFile.prompt,
        createdAt: chatFile.createdAt,
      })
      .from(chatFile)
      .leftJoin(bot, eq(bot.id, chatFile.botId))
      .where(
        and(
          eq(chatFile.userId, c.get("session").user.id),
          botId ? eq(chatFile.botId, botId) : undefined,
          cursor ? lt(chatFile.createdAt, new Date(cursor)) : undefined,
        ),
      )
      .orderBy(desc(chatFile.createdAt))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    c.header("Cache-Control", "no-store");
    return c.json({ files: items, nextCursor: rows.length > limit ? items.at(-1)!.createdAt.toISOString() : null });
  })

  .get("/:id", async (c) => {
    const { db } = getRequestContext(c);
    const row = await ownedFile(db, c.get("session").user.id, c.req.param("id"));
    return row ? c.json({ file: toRef(row) }) : c.json({ error: "NOT_FOUND" }, 404);
  })

  // The bytes. Images are shown inline (chat previews); everything else downloads. `?download=1` always downloads.
  .get("/:id/content", async (c) => {
    const { db, env } = getRequestContext(c);
    const row = await ownedFile(db, c.get("session").user.id, c.req.param("id"));
    const object = row ? await env.FILES!.get(row.storageKey) : null;
    if (!row || !object) return c.json({ error: "NOT_FOUND" }, 404);
    const inline = isInline(row.mimeType) && c.req.query("download") !== "1";
    return new Response(object.body, {
      headers: {
        // A stored HTML or SVG file must never run as a page of the API's origin (it holds the session cookie).
        "Content-Type": inline ? row.mimeType : "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.name)}`,
        "Content-Length": String(object.size),
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
        // Files never change, but they are private: only this browser may keep them.
        "Cache-Control": "private, max-age=86400, immutable",
      },
    });
  })

  .delete("/:id", userLimit, async (c) => {
    const { db, env } = getRequestContext(c);
    const row = await ownedFile(db, c.get("session").user.id, c.req.param("id"));
    if (!row) return c.json({ error: "NOT_FOUND" }, 404);
    await env.FILES!.delete(row.storageKey);
    await db.delete(chatFile).where(eq(chatFile.id, row.id));
    return c.json({ ok: true });
  });

export default browse;
