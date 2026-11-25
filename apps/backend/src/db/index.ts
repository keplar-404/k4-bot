// Neon guide, "Neon WebSocket" option: long-running server, interactive transactions.
// Bun has a global WebSocket, so `ws` / neonConfig.webSocketConstructor is not needed.
import { Pool } from "@neondatabase/serverless";
import * as schema from "@repo/shared/schema";
import { drizzle } from "drizzle-orm/neon-serverless";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not defined");
}

// Neon suspends an idle compute (5 min) and drops its sockets: close idle clients before
// that, fail fast instead of hanging, and log (not crash on) a dropped idle client.
export const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	idleTimeoutMillis: 5_000,
	connectionTimeoutMillis: 5_000,
});
pool.on("error", (error: Error) =>
	console.error("idle database client", error.message),
);
export const db = drizzle(pool, { schema });
