import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { auth, webUrl } from "./auth";
import { db } from "./db";
import { agentEvent, chat } from "./db/app-schema";

// Better Auth Hono integration: read the session in a middleware.
type Env = { Variables: { user: typeof auth.$Infer.Session.user } };

const requireUser = createMiddleware<Env>(async (c, next) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) return c.json({ error: "Unauthorized" }, 401);
	c.set("user", session.user);
	await next();
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
	.get("/:id", async (c) => {
		const [row] = await db
			.select()
			.from(chat)
			.where(
				and(eq(chat.id, c.req.param("id")), eq(chat.userId, c.get("user").id)),
			);
		if (!row) return c.json({ error: "Not found" }, 404);
		return c.json({ chat: row }, 200);
	})
	.patch(
		"/:id",
		zValidator("json", z.object({ eveSessionId: z.string().min(1) })),
		async (c) => {
			const [row] = await db
				.update(chat)
				.set({ eveSessionId: c.req.valid("json").eveSessionId })
				.where(
					and(
						eq(chat.id, c.req.param("id")),
						eq(chat.userId, c.get("user").id),
					),
				)
				.returning({ id: chat.id });
			if (!row) return c.json({ error: "Not found" }, 404);
			return c.json({ id: row.id }, 200);
		},
	)
	.delete("/:id", async (c) => {
		const userId = c.get("user").id;
		const [row] = await db
			.select({ eveSessionId: chat.eveSessionId })
			.from(chat)
			.where(and(eq(chat.id, c.req.param("id")), eq(chat.userId, userId)));
		if (!row) return c.json({ error: "Not found" }, 404);
		if (row.eveSessionId) {
			// eve docs: POST /session/:id/end retires the session. Sent as this user
			// (their cookie), so the agent's ownership check applies. 409 = already ended.
			const res = await fetch(
				`${eveUrl}/eve/v1/session/${row.eveSessionId}/end`,
				{
					method: "POST",
					headers: {
						"content-type": "application/json",
						cookie: c.req.header("cookie") ?? "",
					},
					body: JSON.stringify({ reason: "Deleted by user" }),
				},
			);
			if (!res.ok && res.status !== 409 && res.status !== 404) {
				return c.json({ error: "Could not end the agent session" }, 502);
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
				.where(and(eq(chat.id, c.req.param("id")), eq(chat.userId, userId)));
		});
		return c.json({ ok: true }, 200);
	});
