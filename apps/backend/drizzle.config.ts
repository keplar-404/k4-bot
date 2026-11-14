import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/db/auth-schema.ts",
	// push only touches these tables, never anything else in the DB
	tablesFilter: ["user", "session", "account", "verification", "rate_limit"],
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: { url: process.env.DATABASE_URL! },
});
