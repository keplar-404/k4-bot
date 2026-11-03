import { Hono } from "hono";
import { and, desc, eq, lt } from "drizzle-orm";
import { getRequestContext } from "../lib/context";
import { FileStoreError, formatBytes, isInline, MAX_FILE_BYTES, ownedFile, saveFile, toRef } from "../lib/files";
import { authGuard, type AuthGuardEnv } from "../middleware/auth-guard";
import { userLimit } from "../middleware/rate-limit";
import { bot, chatFile } from "../db/schema";

/**
 * The user's files: uploads, images bots created, and files bots shared from the computer.
 * Every route is the signed-in user's own files only; bytes are served from R2, never from the computer.
 */
const files = new Hono<AuthGuardEnv>()
  .use("*", authGuard)
  .use("*", async (c, next) => {
    if (!c.env.FILES) return c.json({ error: "UNAVAILABLE", message: "File storage is not configured." }, 503);
    await next();
  })

  // Upload one file (multipart field "file"), optionally for a bot's chat. It is linked to the chat when sent.
  .post("/", userLimit, async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    if (Number(c.req.header("content-length") ?? 0) > MAX_FILE_BYTES + 64 * 1024) {
      return c.json({ error: "TOO_LARGE", message: `Files can be at most ${formatBytes(MAX_FILE_BYTES)}.` }, 413);
    }
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) return c.json({ error: "INVALID_INPUT", message: "No file." }, 400);
    if (file.size > MAX_FILE_BYTES) {
      return c.json({ error: "TOO_LARGE", message: `Files can be at most ${formatBytes(MAX_FILE_BYTES)}.` }, 413);
    }
    const botId = form?.get("botId");
    let ownedBot: string | null = null;
    if (typeof botId === "string" && botId) {
      const [row] = await db.select({ id: bot.id }).from(bot).where(and(eq(bot.id, botId), eq(bot.userId, userId))).limit(1);
      ownedBot = row?.id ?? null;
    }
    try {
      const ref = await saveFile(env.FILES!, db, { maxStorageBytes: env.MAX_STORAGE_MB_PER_USER * 1024 * 1024 }, {
        userId,
        botId: ownedBot,
        source: "upload",
        name: file.name,
        mimeType: file.type,
        bytes: await file.arrayBuffer(),
      });
      return c.json({ file: ref }, 201);
    } catch (error) {
      if (error instanceof FileStoreError) return c.json({ error: "STORAGE_FULL", message: error.message }, 413);
      throw error;
    }
  })

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

export default files;
