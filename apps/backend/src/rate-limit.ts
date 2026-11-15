import { sql } from "drizzle-orm";
import { db } from "./db";

// One counter per key (use the user id), so one user's traffic never counts against
// another's. Fixed window, stored in the app's rate_limit table (db/app-schema.ts) so
// every instance shares it. Returns true when the caller is over `max` in the window.
// The agent has the same query in apps/ai-agent/agent/lib/db.ts (it uses the Neon HTTP
// driver, not Drizzle); change both together.
export async function overLimit(key: string, max: number, windowMs: number) {
	const now = Date.now();
	const start = now - windowMs;
	const { rows } = await db.execute(sql`
		insert into rate_limit (id, key, count, last_request)
		values (${crypto.randomUUID()}, ${key}, 1, ${now})
		on conflict (key) do update set
			count = case when rate_limit.last_request < ${start} then 1 else rate_limit.count + 1 end,
			last_request = case when rate_limit.last_request < ${start} then ${now} else rate_limit.last_request end
		returning count`);
	return Number((rows[0] as { count: number }).count) > max;
}
