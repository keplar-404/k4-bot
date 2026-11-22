// The user's files in R2, under `u/<user>/c/<chat>/` (the prefix is the owner check,
// so there is no file table). Bytes go browser ⇄ R2 directly; this only signs links.
//   POST /api/files/upload  -> a 60 s upload link for one chat file, plus the link the
//                              model reads it from (7 days: eve resends it every turn)
//   GET  /api/files?key=    -> a 5-minute download link (the chat's file cards)
import { zValidator } from "@hono/zod-validator";
import {
	ALLOWED_FILE_TYPES,
	cleanFileName,
	fileKey,
	MAX_FILE_BYTES,
	ownsKey,
} from "@repo/shared/files";
import { presignDownload, presignUpload } from "@repo/shared/r2";
import { chat } from "@repo/shared/schema";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { type Env, requireUser } from "./auth";
import { db } from "./db";

const SESSION_SECONDS = 7 * 24 * 60 * 60;

export const files = new Hono<Env>()
	.use(requireUser)
	.post(
		"/upload",
		zValidator(
			"json",
			z.object({
				chatId: z.uuid(),
				name: z.string().min(1).max(255),
				type: z.string().refine((t) => ALLOWED_FILE_TYPES.has(t)),
				size: z.number().int().min(1).max(MAX_FILE_BYTES),
			}),
		),
		async (c) => {
			const { chatId, type, size } = c.req.valid("json");
			const userId = c.get("user").id;
			const [own] = await db
				.select({ id: chat.id })
				.from(chat)
				.where(and(eq(chat.id, chatId), eq(chat.userId, userId)));
			if (!own) return c.json({ error: "Not found" }, 404);
			const name = cleanFileName(c.req.valid("json").name) ?? "file";
			const key = fileKey(userId, chatId, name);
			const [put, read] = await Promise.all([
				// Signed for this exact size and type, so nothing else can be sent.
				presignUpload(key, { name, type, size }),
				presignDownload(key, name, SESSION_SECONDS),
			]);
			return c.json({ key, name, put, read }, 200);
		},
	)
	.get(
		"/",
		zValidator("query", z.object({ key: z.string().min(1).max(1024) })),
		async (c) => {
			const { key } = c.req.valid("query");
			if (!ownsKey(c.get("user").id, key))
				return c.json({ error: "Not found" }, 404);
			const name = decodeURIComponent(key.split("/").pop() ?? "file");
			return c.json({ url: await presignDownload(key, name) }, 200);
		},
	);
