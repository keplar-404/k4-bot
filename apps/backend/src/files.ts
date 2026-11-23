// The user's files in R2, under `u/<user>/c/<chat>/` (the prefix is the owner check,
// so there is no file table). Bytes go browser ⇄ R2 directly; this only signs links.
//   POST /api/files/upload  -> a 60 s upload link for one chat file, plus the link the
//                              model reads it from (7 days: eve resends it every turn)
//   GET  /api/files?key=    -> a 5-minute download link (the chat's file cards);
//                              &inline=1 lets the browser show it instead
//   GET  /api/files/list?chatId= -> the chat's files (right panel > Files)
//   DELETE /api/files?key=  -> deletes one of the user's files
import { zValidator } from "@hono/zod-validator";
import {
	ALLOWED_FILE_TYPES,
	chatPrefix,
	cleanFileName,
	fileKey,
	MAX_FILE_BYTES,
	ownsKey,
} from "@repo/shared/files";
import {
	deleteFile,
	listFiles,
	presignDownload,
	presignUpload,
} from "@repo/shared/r2";
import { overLimitInMemory } from "@repo/shared/rate-limit";
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
		zValidator(
			"query",
			z.object({
				key: z.string().min(1).max(1024),
				inline: z.literal("1").optional(),
			}),
		),
		async (c) => {
			const { key, inline } = c.req.valid("query");
			if (!ownsKey(c.get("user").id, key))
				return c.json({ error: "Not found" }, 404);
			const name = decodeURIComponent(key.split("/").pop() ?? "file");
			const url = await presignDownload(key, name, undefined, !!inline);
			return c.json({ url }, 200);
		},
	)
	// The prefix is built from the token's user id, so only their own chat's files list.
	.get(
		"/list",
		zValidator("query", z.object({ chatId: z.uuid() })),
		async (c) => {
			const userId = c.get("user").id;
			// Each list is a paid R2 call; the web app caches it, so 20 a minute is plenty.
			// Counted in memory: no Neon write per request.
			if (overLimitInMemory(`files-list:${userId}`, 20, 60_000))
				return c.json({ error: "Too many requests" }, 429);
			const prefix = chatPrefix(userId, c.req.valid("query").chatId);
			const files = (await listFiles(prefix)).map((f) => ({
				...f,
				name: decodeURIComponent(f.key.split("/").pop() ?? "file"),
			}));
			return c.json({ files }, 200);
		},
	)
	.delete(
		"/",
		zValidator("query", z.object({ key: z.string().min(1).max(1024) })),
		async (c) => {
			const { key } = c.req.valid("query");
			if (!ownsKey(c.get("user").id, key))
				return c.json({ error: "Not found" }, 404);
			await deleteFile(key);
			return c.json({ ok: true }, 200);
		},
	);
