import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { createDb } from "./src/db";
import { composioFor } from "./src/modules/composio/client";
import { syncCatalog } from "./src/modules/composio/catalog-sync";
import { parseEnv } from "./src/config/env";

const env = parseEnv(process.env);
const sql = neon(env.DATABASE_URL);
for (const stmt of readFileSync("drizzle/0024_slim_lorna_dane.sql", "utf8").split("--> statement-breakpoint")) {
  if (stmt.trim()) await sql.query(stmt);
}
console.log("columns added");
const n = await syncCatalog(createDb(env.DATABASE_URL), composioFor(env));
console.log("catalog synced:", n);
const rows = await sql.query(`select count(*)::int n from composio_toolkit where auth_schemes ?| array['API_KEY','BEARER_TOKEN','BASIC']`);
console.log("apps with key sign-in:", rows[0].n);
const some = await sql.query(`select slug, auth_schemes from composio_toolkit where auth_schemes ?| array['API_KEY','BEARER_TOKEN'] order by rank limit 6`);
console.log(some);
