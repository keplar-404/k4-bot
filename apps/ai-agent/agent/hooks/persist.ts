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
		},
	},
});
