import { sql } from "drizzle-orm";
import type { Db } from "./db";
import { rateLimit } from "./schema";

/**
 * Per-key fixed-window counter in the rate_limit table, shared by every instance.
 * Use the user id in the key, so one user's traffic never counts against another's.
 * Returns true when the caller is over `max` in the window.
 */
export async function overLimit(
	db: Db,
	key: string,
	max: number,
	windowMs: number,
) {
	const now = Date.now();
	const expired = sql`${rateLimit.lastRequest} < ${now - windowMs}`;
	const [row] = await db
		.insert(rateLimit)
		.values({ key, count: 1, lastRequest: now })
		.onConflictDoUpdate({
			target: rateLimit.key,
			set: {
				count: sql`case when ${expired} then 1 else ${rateLimit.count} + 1 end`,
				lastRequest: sql`case when ${expired} then ${now} else ${rateLimit.lastRequest} end`,
			},
		})
		.returning({ count: rateLimit.count });
	return Number(row?.count) > max;
}
