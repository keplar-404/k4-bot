// Neon HTTP driver: one-shot queries (Neon serverless-driver docs).
// Tables are owned by apps/backend (drizzle schema in src/db/app-schema.ts).
import { neon } from "@neondatabase/serverless";

let client: ReturnType<typeof neon> | undefined;

export function sql() {
	if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not defined");
	client ??= neon(process.env.DATABASE_URL);
	return client;
}

/** The signed-in app user behind a session's auth, or null (TUI, OIDC callers). */
export function appUserId(
	auth: { authenticator: string; principalId: string } | null | undefined,
): string | null {
	return auth?.authenticator === "neon-auth" ? auth.principalId : null;
}

/** Per-user fixed-window counter in the rate_limit table. True when over `max`. */
export async function overLimit(key: string, max: number, windowMs: number) {
	const now = Date.now();
	const start = now - windowMs;
	const [row] = (await sql()`
		insert into rate_limit (id, key, count, last_request)
		values (${crypto.randomUUID()}, ${key}, 1, ${now})
		on conflict (key) do update set
			count = case when rate_limit.last_request < ${start} then 1 else rate_limit.count + 1 end,
			last_request = case when rate_limit.last_request < ${start} then ${now} else rate_limit.last_request end
		returning count`) as { count: number }[];
	return Number(row.count) > max;
}
