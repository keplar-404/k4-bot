// eve docs, Hooks > "Persist events to your own database": copy every recorded
// event (thoughts, tool calls, search, replies, usage) into agent_event.
// (session, line, index) is the event's stable stream position, so re-reads
// don't duplicate rows. eve itself checkpoints each step and resumes from it.
import { agentEvent } from "@repo/shared/schema";
import { defineHook } from "eve/hooks";
import { appUserId, db } from "../lib/db";
import { withoutPageText } from "../lib/page-text";

type Row = typeof agentEvent.$inferInsert;

// Rows wait here and go to Neon in one insert: about 2-4 requests per reply
// instead of one per event (about 11). Neon bills transfer and compute, so
// fewer round trips cost less.
let rows: Row[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function flush() {
	clearTimeout(timer);
	timer = undefined;
	const batch = rows;
	rows = [];
	if (batch.length === 0) return Promise.resolve();
	return db()
		.insert(agentEvent)
		.values(batch)
		.onConflictDoNothing()
		.then(
			() => {},
			// A missed copy must not break the chat, so failures are only logged.
			(error: unknown) =>
				console.error("agent_event insert failed", batch.length, error),
		);
}

// Where the turn ends or waits on the user: write now, and the turn waits for it
// (eve docs, Hooks > Execution order), so a finished turn is always saved.
const SETTLED = new Set([
	"turn.settled",
	"turn.paused",
	"interaction.opened",
	"session.ended",
]);

export default defineHook({
	events: {
		"*"(event, ctx) {
			// Read ctx now: it isn't valid after the handler returns.
			rows.push({
				sessionId: ctx.session.id,
				line: ctx.position.line,
				index: ctx.position.index,
				userId: appUserId(ctx.session.auth.initiator),
				type: event.type,
				// {} for session-level events: null marks rows saved before scope existed.
				scope: ("scope" in event ? event.scope : undefined) ?? {},
				data: withoutPageText(event.data) ?? null,
			});
			if (SETTLED.has(event.type) || rows.length >= 100) return flush();
			// Mid-turn events are not awaited, so the reply never waits on Neon.
			// ponytail: a crash loses at most the last second of a running turn.
			timer ??= setTimeout(flush, 1000);
		},
	},
});
