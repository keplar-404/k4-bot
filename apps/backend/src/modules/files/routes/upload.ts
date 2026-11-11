import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { and, eq } from "drizzle-orm";
import { getRequestContext } from "../../../shared/context";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { userLimit } from "../../../middleware/rate-limit";
import { bot } from "../../../db/schema";
import { FileStoreError, formatBytes, MAX_FILE_BYTES, saveFile } from "..";

const tooLarge = { error: "TOO_LARGE", message: `Files can be at most ${formatBytes(MAX_FILE_BYTES)}.` } as const;

const upload = new Hono<AuthGuardEnv>()
  // Upload one file (multipart field "file"), optionally for a bot's chat. It is linked to the chat when sent.
  // The global 1 MiB limit skips this route; cap the body at the file limit itself.
  .post("/", userLimit, bodyLimit({ maxSize: MAX_FILE_BYTES + 64 * 1024 }), async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    if (Number(c.req.header("content-length") ?? 0) > MAX_FILE_BYTES + 64 * 1024) return c.json(tooLarge, 413);
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) return c.json({ error: "INVALID_INPUT", message: "No file." }, 400);
    if (file.size > MAX_FILE_BYTES) return c.json(tooLarge, 413);
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
  });

export default upload;
