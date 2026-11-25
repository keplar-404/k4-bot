import { sql } from "drizzle-orm";
import type { Db } from "./db";
import { rateLimit } from "./schema";

/**
 * Per-key fixed-window counter in the rate_limit table, shared by every instance.
 * Use the user id in the key, so one user's traffic never counts against another's.
 * Returns true when the caller is over `max` in the window. `by` adds more than one
 * (seconds of audio); `by: 0` only reads the count.
 */
export async function overLimit(
	db: Db,
	key: string,
	max: number,
	windowMs: number,
	by = 1,
) {
	const now = Date.now();
	const expired = sql`${rateLimit.lastRequest} < ${now - windowMs}`;
	const [row] = await db
		.insert(rateLimit)
		.values({ key, count: by, lastRequest: now })
		.onConflictDoUpdate({
			target: rateLimit.key,
			set: {
				count: sql`case when ${expired} then ${by} else ${rateLimit.count} + ${by} end`,
				lastRequest: sql`case when ${expired} then ${now} else ${rateLimit.lastRequest} end`,
			},
		})
		.returning({ count: rateLimit.count });
	return Number(row?.count) > max;
}

// In-process fixed windows for cheap, frequent calls (reads): no database write per
// request. Each instance counts on its own, so the real limit is max × instances.
// The map is capped: when full, the oldest entries (insertion order) are dropped.
const windows = new Map<string, { count: number; start: number }>();
const MAX_KEYS = 10_000;

/** Like overLimit, but counted in memory on this instance only. */
export function overLimitInMemory(key: string, max: number, windowMs: number) {
	const now = Date.now();
	const w = windows.get(key);
	if (!w || now - w.start >= windowMs) {
		windows.delete(key);
		if (windows.size >= MAX_KEYS) {
			const oldest = windows.keys().next().value;
			if (oldest !== undefined) windows.delete(oldest);
		}
		windows.set(key, { count: 1, start: now });
		return false;
	}
	w.count += 1;
	return w.count > max;
}

export const DAY_MS = 24 * 60 * 60_000;
