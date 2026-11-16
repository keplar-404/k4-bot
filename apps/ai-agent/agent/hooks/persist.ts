// eve docs, Hooks > "Persist events to your own database": copy every recorded
// event (thoughts, tool calls, search, replies, usage) into agent_event.
// (session, line, index) is the event's stable stream position, so re-reads
// don't duplicate rows. eve itself checkpoints each step and resumes from it.
import { agentEvent } from "@repo/shared/schema";
import { defineHook } from "eve/hooks";
import { appUserId, db } from "../lib/db";

export default defineHook({
	events: {
		async "*"(event, ctx) {
			// eve docs (Hooks > "What happens when a hook throws"): an uncaught error
			// fails the user's turn. A missed copy must not break the chat, so log it.
			try {
				await db()
					.insert(agentEvent)
					.values({
						sessionId: ctx.session.id,
						line: ctx.position.line,
						index: ctx.position.index,
						userId: appUserId(ctx.session.auth.initiator),
						type: event.type,
						data: event.data ?? null,
					})
					.onConflictDoNothing();
			} catch (error) {
				console.error("agent_event insert failed", ctx.session.id, error);
			}
		},
	},
});
