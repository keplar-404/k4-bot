// Helper agents (PLAN.md): at most MAX_HELPERS `agent` calls work at once per chat.
// eve's own limit is 32 tasks; the approval policy (agent.ts) checks this one first.
// The policy has no session view, so the working calls are kept in state (eve docs:
// State) and hooks/helpers.ts removes each one when it settles. The policy can run
// twice for one call (a recheck), so a call already counted is allowed again.
import { defineState } from "eve/context";

export const MAX_HELPERS = 5;

const working = defineState<string[]>("k4.helpers.working", () => []);

/** A denial reason when MAX_HELPERS helpers are already working, else undefined. */
export function helperSlot(callId: string): string | undefined {
	const now = working.get();
	if (now.includes(callId)) return undefined;
	if (now.length >= MAX_HELPERS)
		return `${MAX_HELPERS} helpers are already working, the most at once. Wait for one with eve__task_wait (or cancel one), then start this one.`;
	working.update((ids) => [...ids, callId]);
	return undefined;
}

export function helperDone(callId: string) {
	working.update((ids) => ids.filter((id) => id !== callId));
}
