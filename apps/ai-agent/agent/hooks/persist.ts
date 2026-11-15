// eve docs, Hooks > "Persist events to your own database": copy every recorded
// event (thoughts, tool calls, search, replies, usage) into agent_event.
// (session, line, index) is the event's stable stream position, so re-reads
// don't duplicate rows. eve itself checkpoints each step and resumes from it.
import { defineHook } from "eve/hooks";
import { appUserId, sql } from "../lib/db";

export default defineHook({
	events: {
		async "*"(event, ctx) {
			const userId = appUserId(ctx.session.auth.initiator);
			await sql()`
				insert into agent_event (session_id, line, index, user_id, type, data)
				values (${ctx.session.id}, ${ctx.position.line}, ${ctx.position.index},
					${userId}, ${event.type}, ${JSON.stringify(event.data ?? null)}::jsonb)
				on conflict (session_id, line, index) do nothing`;
		},
	},
});
