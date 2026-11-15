import { zValidator } from "@hono/zod-validator";
import { screenshotUrl } from "@repo/shared/storage";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { type Env, requireUser, webUrl } from "./auth";
import { db } from "./db";
import { agentEvent, chat } from "./db/app-schema";

// Chat ids are UUIDs we made. Anything else is simply "not found" (the web app
// then sends the user to a new chat).
const chatId = zValidator("param", z.object({ id: z.uuid() }), (result, c) => {
	if (!result.success) return c.json({ error: "Not found" }, 404);
});

// The eve agent is reached through the web app's /eve/v1 proxy (eve/next).
const eveUrl = process.env.EVE_URL ?? webUrl;

// Chained so Hono RPC can infer every route's types (hono.dev/docs/guides/rpc).
export const chats = new Hono<Env>()
	.use(requireUser)
	.get("/", async (c) => {
		const rows = await db
			.select({ id: chat.id, title: chat.title, updatedAt: chat.updatedAt })
			.from(chat)
			.where(eq(chat.userId, c.get("user").id))
			.orderBy(desc(chat.updatedAt));
		return c.json({ chats: rows }, 200);
	})
	.post(
		"/",
		zValidator("json", z.object({ title: z.string().trim().min(1).max(200) })),
		async (c) => {
			const [row] = await db
				.insert(chat)
				.values({
					id: crypto.randomUUID(),
					userId: c.get("user").id,
					title: c.req.valid("json").title,
				})
				.returning({ id: chat.id });
			return c.json({ id: row.id }, 201);
		},
	)
	// A short-lived link to one of the user's own desktop screenshots. The first
	// segment of the key is the owner (see newScreenshotKey).
	.get(
		"/screenshot",
		zValidator("query", z.object({ key: z.string().max(300) })),
		async (c) => {
			const { key } = c.req.valid("query");
			if (!key.startsWith(`${c.get("user").id}/`)) {
				return c.json({ error: "Not found" }, 404);
			}
			return c.json({ url: await screenshotUrl(key) }, 200);
		},
	)
	.get("/:id", chatId, async (c) => {
		const [row] = await db
			.select()
			.from(chat)
			.where(
				and(
					eq(chat.id, c.req.valid("param").id),
					eq(chat.userId, c.get("user").id),
				),
			);
		if (!row) return c.json({ error: "Not found" }, 404);
		return c.json({ chat: row }, 200);
	})
	.patch(
		"/:id",
		chatId,
		zValidator("json", z.object({ eveSessionId: z.string().min(1).max(200) })),
		async (c) => {
			const [row] = await db
				.update(chat)
				.set({ eveSessionId: c.req.valid("json").eveSessionId })
				.where(
					and(
						eq(chat.id, c.req.valid("param").id),
						eq(chat.userId, c.get("user").id),
					),
				)
				.returning({ id: chat.id });
			if (!row) return c.json({ error: "Not found" }, 404);
			return c.json({ id: row.id }, 200);
		},
	)
	.delete("/:id", chatId, async (c) => {
		const userId = c.get("user").id;
		const [row] = await db
			.select({ eveSessionId: chat.eveSessionId })
			.from(chat)
			.where(
				and(eq(chat.id, c.req.valid("param").id), eq(chat.userId, userId)),
			);
		if (!row) return c.json({ error: "Not found" }, 404);
		if (row.eveSessionId) {
			// eve docs: POST /session/:id/end retires the session. Sent as this user
			// (their token), so the agent's ownership check applies. A failure must not
			// block deleting the user's own data: the session just stays unused.
			try {
				const res = await fetch(
					`${eveUrl}/eve/v1/session/${encodeURIComponent(row.eveSessionId)}/end`,
					{
						method: "POST",
						headers: {
							"content-type": "application/json",
							authorization: c.req.header("authorization") ?? "",
						},
						body: JSON.stringify({ reason: "Deleted by user" }),
						signal: AbortSignal.timeout(10_000),
					},
				);
				if (!res.ok && res.status !== 409 && res.status !== 404) {
					console.error("end session failed", row.eveSessionId, res.status);
				}
			} catch (error) {
				console.error("end session failed", row.eveSessionId, error);
			}
		}
		// drizzle skill: multi-step writes that must succeed together go in a transaction.
		await db.transaction(async (tx) => {
			if (row.eveSessionId) {
				await tx
					.delete(agentEvent)
					.where(
						and(
							eq(agentEvent.sessionId, row.eveSessionId),
							eq(agentEvent.userId, userId),
						),
					);
			}
			await tx
				.delete(chat)
				.where(
					and(eq(chat.id, c.req.valid("param").id), eq(chat.userId, userId)),
				);
		});
		return c.json({ ok: true }, 200);
	});
