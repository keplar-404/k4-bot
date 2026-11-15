// Neon guide, "Neon WebSocket" option: long-running server, interactive transactions.
// Bun has a global WebSocket, so `ws` / neonConfig.webSocketConstructor is not needed.
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as appSchema from "./app-schema";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not defined");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema: appSchema });
