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
	return auth?.authenticator === "better-auth" ? auth.principalId : null;
}
