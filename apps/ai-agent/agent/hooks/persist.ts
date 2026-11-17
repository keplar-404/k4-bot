// eve docs, Hooks > "Persist events to your own database": copy every recorded
// event (thoughts, tool calls, search, replies, usage) into agent_event.
// (session, line, index) is the event's stable stream position, so re-reads
// don't duplicate rows. eve itself checkpoints each step and resumes from it.
import { agentEvent } from "@repo/shared/schema";
import { defineHook } from "eve/hooks";
import { appUserId, db } from "../lib/db";

export default defineHook({
	events: {
		"*"(event, ctx) {
			// eve docs (Hooks > Execution order): the turn waits for each line's hooks.
			// This copy isn't needed to continue, so it is not awaited: the turn
			// doesn't pay a database round trip per event. A missed copy must not
			// break the chat, so failures are only logged.
			// ponytail: a process crash can drop the copies still in flight.
			// Read ctx now: it isn't valid after the handler returns.
			const sessionId = ctx.session.id;
			db()
				.insert(agentEvent)
				.values({
					sessionId,
					line: ctx.position.line,
					index: ctx.position.index,
					userId: appUserId(ctx.session.auth.initiator),
					type: event.type,
					// {} for session-level events: null marks rows saved before scope existed.
					scope: ("scope" in event ? event.scope : undefined) ?? {},
					data: event.data ?? null,
				})
				.onConflictDoNothing()
				.catch((error: unknown) =>
					console.error("agent_event insert failed", sessionId, error),
				);
		},
	},
});
