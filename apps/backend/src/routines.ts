// Routines API (plug-in module: mounted with one line in index.ts). Reads, edits, "Run
// test" records, and the approval inbox. Starting a run's agent session happens in the
// browser (Run test) or in the agent's dispatcher schedule (scheduled runs).
import { zValidator } from "@hono/zod-validator";
import { chatPrefix } from "@repo/shared/files";
import { deletePrefix } from "@repo/shared/r2";
import { overLimit } from "@repo/shared/rate-limit";
import {
	APPROVAL_TTL_MS,
	createRun,
	MAX_ROUTINES,
	nextRun,
	REPEATS,
	routine,
	routineApproval,
	routineRun,
	validStart,
	validTimezone,
} from "@repo/shared/routines";
import { agentEvent, chat } from "@repo/shared/schema";
import { and, count, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { type Env, requireUser, webUrl } from "./auth";
import { db } from "./db";
import { composio } from "./me";

const id = zValidator("param", z.object({ id: z.uuid() }), (r, c) => {
	if (!r.success) return c.json({ error: "Not found" }, 404);
});
const timing = {
	startAt: z.string().refine(validStart, "YYYY-MM-DDTHH:mm"),
	repeat: z.enum(REPEATS),
	timezone: z.string().max(64).refine(validTimezone, "IANA timezone"),
};
const fields = z.object({
	name: z.string().trim().min(1).max(60),
	instructions: z.string().trim().min(1).max(4000),
	...timing,
});
const eveUrl = process.env.EVE_URL ?? webUrl;
const mine = (userId: string, routineId: string) =>
	and(eq(routine.id, routineId), eq(routine.userId, userId));

export const routines = new Hono<Env>()
	.use(requireUser)
	// The sidebar: every routine and how many drafts wait on the user.
	.get("/", async (c) => {
		const userId = c.get("user").id;
		const rows = await db
			.select({
				id: routine.id,
				name: routine.name,
				enabled: routine.enabled,
				// Table-qualified on purpose: a bare "id" here would mean the subquery's own a.id.
				needs: sql<number>`(select count(*)::int from user_routine_approval a where a.routine_id = "user_routine"."id" and a.status = 'pending')`,
			})
			.from(routine)
			.where(eq(routine.userId, userId))
			.orderBy(desc(routine.createdAt));
		return c.json({ routines: rows }, 200);
	})
	.post("/", zValidator("json", fields), async (c) => {
		const userId = c.get("user").id;
		const body = c.req.valid("json");
		const [{ n }] = await db
			.select({ n: count() })
			.from(routine)
			.where(eq(routine.userId, userId));
		if (n >= MAX_ROUTINES)
			return c.json(
				{ error: `You can have up to ${MAX_ROUTINES} routines.` },
				409,
			);
		const [row] = await db
			.insert(routine)
			.values({
				id: crypto.randomUUID(),
				userId,
				...body,
				nextRunAt: nextRun(body, new Date()),
			})
			.returning({ id: routine.id });
		return c.json({ id: row.id }, 201);
	})
	// The routine page in one call: routine, counts, recent runs, waiting drafts.
	.get("/:id", id, async (c) => {
		const userId = c.get("user").id;
		const rid = c.req.valid("param").id;
		const [r] = await db.select().from(routine).where(mine(userId, rid));
		if (!r) return c.json({ error: "Not found" }, 404);
		const [stats, runs, approvals] = await Promise.all([
			db
				.select({ status: routineRun.status, n: count() })
				.from(routineRun)
				.where(
					and(eq(routineRun.routineId, rid), eq(routineRun.userId, userId)),
				)
				.groupBy(routineRun.status),
			db
				.select({
					id: routineRun.id,
					chatId: routineRun.chatId,
					trigger: routineRun.trigger,
					status: routineRun.status,
					error: routineRun.error,
					startedAt: routineRun.startedAt,
					endedAt: routineRun.endedAt,
				})
				.from(routineRun)
				.where(
					and(eq(routineRun.routineId, rid), eq(routineRun.userId, userId)),
				)
				.orderBy(desc(routineRun.startedAt))
				.limit(50),
			db
				.select({
					id: routineApproval.id,
					runId: routineApproval.runId,
					chatId: routineApproval.chatId,
					title: routineApproval.title,
					summary: routineApproval.summary,
					preview: routineApproval.preview,
					kind: sql<
						"app" | "chat"
					>`case when ${routineApproval.action} is null then 'chat' else 'app' end`,
					createdAt: routineApproval.createdAt,
				})
				.from(routineApproval)
				.where(
					and(
						eq(routineApproval.routineId, rid),
						eq(routineApproval.userId, userId),
						eq(routineApproval.status, "pending"),
						gt(
							routineApproval.createdAt,
							new Date(Date.now() - APPROVAL_TTL_MS),
						),
					),
				)
				.orderBy(desc(routineApproval.createdAt)),
		]);
		const by = Object.fromEntries(stats.map((s) => [s.status, s.n]));
		return c.json(
			{
				routine: { ...r, userId: undefined },
				stats: {
					runs: stats.reduce((t, s) => t + s.n, 0),
					ok: by.ok ?? 0,
					failed: by.failed ?? 0,
					needsYou: approvals.length,
				},
				runs,
				approvals,
			},
			200,
		);
	})
	// Edit routine: name, instructions, timing, pause. Steps and the no-approval list are
	// written only by the agent in routine runs (agent/lib/routine-notes.ts).
	.patch(
		"/:id",
		id,
		zValidator(
			"json",
			fields
				.extend({
					enabled: z.boolean(),
				})
				.partial(),
		),
		async (c) => {
			const userId = c.get("user").id;
			const rid = c.req.valid("param").id;
			const patch = c.req.valid("json");
			const [r] = await db.select().from(routine).where(mine(userId, rid));
			if (!r) return c.json({ error: "Not found" }, 404);
			const next = { ...r, ...patch };
			const [row] = await db
				.update(routine)
				.set({
					...patch,
					nextRunAt: next.enabled ? nextRun(next, new Date()) : null,
				})
				.where(mine(userId, rid))
				.returning({ id: routine.id, nextRunAt: routine.nextRunAt });
			return c.json(row, 200);
		},
	)
	// Delete a routine and everything it made: run chats (their agent sessions, events and
	// R2 files, as deleting a chat does), runs and drafts. Only the user, here; the agent
	// has no delete tool. Paused first, so the schedule can't start a run meanwhile.
	.delete("/:id", id, async (c) => {
		const userId = c.get("user").id;
		const rid = c.req.valid("param").id;
		const [r] = await db
			.update(routine)
			.set({ enabled: false, nextRunAt: null })
			.where(mine(userId, rid))
			.returning({ id: routine.id });
		if (!r) return c.json({ error: "Not found" }, 404);
		const runs = await db
			.select({ chatId: routineRun.chatId, sessionId: routineRun.sessionId })
			.from(routineRun)
			.where(and(eq(routineRun.routineId, rid), eq(routineRun.userId, userId)));
		// Sessions and files: failures are logged and never block deleting the data.
		// Five at a time, so a routine with many runs doesn't flood eve or R2.
		for (let i = 0; i < runs.length; i += 5)
			await Promise.all(
				runs.slice(i, i + 5).flatMap((run) => [
					run.sessionId
						? fetch(
								`${eveUrl}/eve/v1/session/${encodeURIComponent(run.sessionId)}/end`,
								{
									method: "POST",
									headers: {
										"content-type": "application/json",
										authorization: c.req.header("authorization") ?? "",
									},
									body: JSON.stringify({ reason: "Routine deleted by user" }),
									signal: AbortSignal.timeout(10_000),
								},
							).catch((e) =>
								console.error("end session failed", run.sessionId, e),
							)
						: undefined,
					deletePrefix(chatPrefix(userId, run.chatId)).catch((e) =>
						console.error("run files not deleted", run.chatId, e),
					),
				]),
			);
		const chatIds = runs.map((x) => x.chatId);
		const sessionIds = runs.flatMap((x) => (x.sessionId ? [x.sessionId] : []));
		await db.transaction(async (tx) => {
			if (sessionIds.length)
				await tx
					.delete(agentEvent)
					.where(
						and(
							inArray(agentEvent.sessionId, sessionIds),
							eq(agentEvent.userId, userId),
						),
					);
			if (chatIds.length)
				await tx
					.delete(chat)
					.where(and(inArray(chat.id, chatIds), eq(chat.userId, userId)));
			await tx
				.delete(routineApproval)
				.where(
					and(
						eq(routineApproval.routineId, rid),
						eq(routineApproval.userId, userId),
					),
				);
			await tx
				.delete(routineRun)
				.where(
					and(eq(routineRun.routineId, rid), eq(routineRun.userId, userId)),
				);
			await tx.delete(routine).where(mine(userId, rid));
		});
		return c.json({ ok: true, chatIds }, 200);
	})
	// Run test: the run's chat and record. The browser then starts the agent session
	// and saves its id (PATCH /runs/:id), before sending the first message.
	.post("/:id/runs", id, async (c) => {
		const userId = c.get("user").id;
		if (await overLimit(db, `routine-test:${userId}`, 10, 60 * 60_000))
			return c.json({ error: "Too many test runs. Try again later." }, 429);
		const [r] = await db
			.select()
			.from(routine)
			.where(mine(userId, c.req.valid("param").id));
		if (!r) return c.json({ error: "Not found" }, 404);
		return c.json(await createRun(db, r, "test"), 201);
	})
	.patch(
		"/runs/:id",
		id,
		zValidator("json", z.object({ sessionId: z.string().min(1).max(200) })),
		async (c) => {
			const userId = c.get("user").id;
			const { sessionId } = c.req.valid("json");
			// Only a run that has no session yet: a session id is set once.
			const [run] = await db
				.update(routineRun)
				.set({ sessionId })
				.where(
					and(
						eq(routineRun.id, c.req.valid("param").id),
						eq(routineRun.userId, userId),
						isNull(routineRun.sessionId),
					),
				)
				.returning({ chatId: routineRun.chatId });
			if (!run) return c.json({ error: "Not found" }, 404);
			await db
				.update(chat)
				.set({ eveSessionId: sessionId })
				.where(and(eq(chat.id, run.chatId), eq(chat.userId, userId)));
			return c.json({ ok: true }, 200);
		},
	)
	// Approve or cancel a draft. Claimed in one update, so it happens once even on a
	// double click or two tabs. Approve on an app draft runs exactly the saved action.
	.post(
		"/approvals/:id",
		id,
		zValidator("json", z.object({ decision: z.enum(["approve", "cancel"]) })),
		async (c) => {
			const userId = c.get("user").id;
			const { decision } = c.req.valid("json");
			const [a] = await db
				.update(routineApproval)
				.set({
					status: decision === "approve" ? "approved" : "cancelled",
					decidedAt: new Date(),
				})
				.where(
					and(
						eq(routineApproval.id, c.req.valid("param").id),
						eq(routineApproval.userId, userId),
						eq(routineApproval.status, "pending"),
						gt(
							routineApproval.createdAt,
							new Date(Date.now() - APPROVAL_TTL_MS),
						),
					),
				)
				.returning();
			if (!a)
				return c.json(
					{ error: "This draft was already handled or expired." },
					409,
				);
			// The run waited only on drafts: with none left, it counts as done.
			await db.execute(sql`
				update user_routine_run set status = 'ok'
				where id = ${a.runId} and user_id = ${userId} and status = 'needs_you'
				and not exists (select 1 from user_routine_approval where run_id = ${a.runId} and status = 'pending')`);
			if (decision === "cancel" || !a.action)
				return c.json({ status: a.status, chatId: a.chatId }, 200);
			const r = await composio()
				.tools.execute(a.action.tool, {
					userId,
					arguments: a.action.arguments,
					dangerouslySkipVersionCheck: true,
				})
				.catch((e: Error) => ({
					successful: false,
					error: e.message,
					data: null,
				}));
			const ok = r.successful === true;
			const result = ok
				? JSON.stringify(r.data ?? {}).slice(0, 2000)
				: String(r.error ?? "The action failed.").slice(0, 2000);
			await db
				.update(routineApproval)
				.set({ status: ok ? "done" : "failed", result })
				.where(eq(routineApproval.id, a.id));
			return c.json(
				{ status: ok ? "done" : "failed", result, chatId: a.chatId },
				ok ? 200 : 502,
			);
		},
	);
