// Routines plug-in: in a routine run, saves a draft that needs the user (an email, a
// post, a merge…) to the routine's "Need your attention" list instead of doing it. Only
// offered in routine runs. For app actions the saved tool + arguments are exactly what
// the user's Approve runs.
import { routineApproval, routineRun } from "@repo/shared/routines";
import { and, eq } from "drizzle-orm";
import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import { db } from "../lib/db";
import { routineRunOf } from "../lib/routine";

const MAX_PENDING = 20; // per run: a loop can't flood the user's list

export default defineDynamic(async (ctx) => {
	if (!ctx.turn) return null;
	const found = await ctx.memo(`routine:${ctx.turn.id}`, () =>
		routineRunOf(ctx.session),
	);
	if (!found) return null;
	return defineTool({
		description:
			"Save something that needs the user's approval (send an email or message, post, publish, merge, delete, pay) as a draft for them to review, instead of doing it. `preview` is exactly what they will see (recipient, subject, full text…). For an app action, give `action` with the exact Composio tool slug and arguments: Approve runs exactly that. Without `action`, Approve sends the user back to this chat. Then continue with the rest of the job.",
		inputSchema: z.object({
			title: z.string().min(1).max(120).describe("e.g. Email to Acme Ltd"),
			summary: z.string().min(1).max(200).describe("e.g. Gmail · send email"),
			preview: z.string().min(1).max(8000),
			action: z
				.object({
					tool: z
						.string()
						.regex(/^[A-Z0-9_]{3,120}$/)
						.describe("Composio tool slug, e.g. GMAIL_SEND_EMAIL"),
					arguments: z.record(z.string(), z.unknown()),
				})
				.optional(),
		}),
		label: { start: ({ title }) => `Draft for review: ${title}` },
		async execute({ title, summary, preview, action }) {
			const { run } = found;
			const pending = await db()
				.select({ id: routineApproval.id })
				.from(routineApproval)
				.where(
					and(
						eq(routineApproval.runId, run.id),
						eq(routineApproval.status, "pending"),
					),
				);
			if (pending.length >= MAX_PENDING)
				return { error: "Too many drafts in this run already." };
			await db()
				.insert(routineApproval)
				.values({
					id: crypto.randomUUID(),
					userId: run.userId,
					routineId: run.routineId,
					runId: run.id,
					chatId: run.chatId,
					title,
					summary,
					preview,
					action: action ?? null,
				});
			await db()
				.update(routineRun)
				.set({ status: "needs_you" })
				.where(eq(routineRun.id, run.id));
			return {
				saved: true,
				note: "The user will review it. Don't do this action yourself.",
			};
		},
	});
});
