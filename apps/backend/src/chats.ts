import { zValidator } from "@hono/zod-validator";
import { chatPrefix } from "@repo/shared/files";
import { deletePrefix } from "@repo/shared/r2";
import { agentEvent, chat } from "@repo/shared/schema";
import { and, desc, eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { type Env, requireUser, webUrl } from "./auth";
import { db } from "./db";

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
	// `after`: the last line this browser already has cached. Only newer events are
	// read (Neon bills every byte sent out); an unchanged chat returns none.
	.get(
		"/:id",
		chatId,
		zValidator(
			"query",
			z.object({ after: z.coerce.number().int().min(-1).optional() }),
		),
		async (c) => {
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
			// The session's saved events, for eve's initialEvents (eve docs: Resume a saved
			// session): the page shows them at once and eve only catches up after them.
			// Token deltas aren't saved; eve rebuilds the same state without them.
			const after = c.req.valid("query").after ?? -1;
			const rows = row.eveSessionId
				? await db
						.select({
							line: agentEvent.line,
							index: agentEvent.index,
							type: agentEvent.type,
							scope: agentEvent.scope,
							data: agentEvent.data,
							createdAt: agentEvent.createdAt,
						})
						.from(agentEvent)
						.where(
							and(
								eq(agentEvent.sessionId, row.eveSessionId),
								// PATCH lets a user set any eveSessionId on their chat: only
								// their own events may come back.
								eq(agentEvent.userId, c.get("user").id),
								gt(agentEvent.line, after),
							),
						)
						.orderBy(agentEvent.line, agentEvent.index)
				: [];
			// Rows saved before `scope` existed can't rebuild the view: replay as before.
			const events = rows.every((e) => e.scope !== null)
				? rows.map((e, i) => ({
						type: e.type,
						scope: e.scope,
						data: e.data,
						meta: {
							position: { line: e.line, index: e.index },
							at: e.createdAt.toISOString(),
							// eve treats a line as done after an event without this, so every
							// event but a line's last says more of its line follows.
							...(rows[i + 1]?.line === e.line ? { endOfLine: false } : {}),
						},
					}))
				: [];
			return c.json({ chat: row, events }, 200);
		},
	)
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
				// 404/410: the session is already gone or expired; 409: already ending.
				if (!res.ok && ![404, 409, 410].includes(res.status)) {
					console.error("end session failed", row.eveSessionId, res.status);
				}
			} catch (error) {
				console.error("end session failed", row.eveSessionId, error);
			}
		}
		// The chat's shared files and media in R2. Like ending the session, a failure
		// must not block deleting the user's data: it is logged and the objects stay.
		const chatId = c.req.valid("param").id;
		await deletePrefix(chatPrefix(userId, chatId))
			.then(({ failed }) => {
				if (failed.length)
					console.error("chat files not deleted", chatId, failed.length);
			})
			.catch((error) => console.error("chat files not deleted", chatId, error));
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
