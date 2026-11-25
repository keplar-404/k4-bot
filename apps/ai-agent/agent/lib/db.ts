// Drizzle on the Neon HTTP driver (one-shot queries, no pool), over the same schema
// the backend migrates (@repo/shared/schema).
import { neon } from "@neondatabase/serverless";
import type { Db } from "@repo/shared/db";
import * as schema from "@repo/shared/schema";
import { drizzle } from "drizzle-orm/neon-http";

let client: Db | undefined;

export function db(): Db {
	if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not defined");
	client ??= drizzle(neon(process.env.DATABASE_URL), { schema });
	return client;
}

/** The signed-in app user behind a session's auth, or null (TUI, OIDC callers). */
export function appUserId(
	auth: { authenticator: string; principalId: string } | null | undefined,
): string | null {
	return auth?.authenticator === "neon-auth" ? auth.principalId : null;
}
