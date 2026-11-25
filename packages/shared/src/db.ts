// The one database type the shared queries accept. Backend (neon-serverless pool) and
// agent (neon-http) both pass their own Drizzle instance; the queries don't care which.
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
