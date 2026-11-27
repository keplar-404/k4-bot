import { defineConfig } from "drizzle-kit";

// Neon: migrations use the direct (unpooled) connection.
if (!process.env.DATABASE_URL_UNPOOLED) {
	throw new Error("DATABASE_URL_UNPOOLED is not set in .env file");
}

export default defineConfig({
	schema: [
		"../../packages/shared/src/schema.ts",
		"../../packages/shared/src/routines.ts",
	],
	// push only touches these tables, never anything else in the DB
	tablesFilter: [
		"rate_limit",
		"chat",
		"agent_event",
		"agent_memory",
		"app_cache",
		"user_skill",
		"user_mcp",
		"user_provider_key",
		"user_routine",
		"user_routine_run",
		"user_routine_approval",
	],
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED },
});
