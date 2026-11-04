import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Third-party web spend (Tavily credits) per scope and UTC day: "all" for the whole app, "user:<id>", "run:<id>" and
 * "research:<userId>". Rows are reserved before a call and corrected after it (agent/tools/web/budget.ts), so the
 * caps hold even with many sub-agents calling at once. No foreign keys: a deleted user must not reset the day's spend.
 */
export const webUsage = pgTable(
  "web_usage",
  {
    scope: text("scope").notNull(),
    day: text("day").notNull(),
    credits: integer("credits").notNull().default(0),
    calls: integer("calls").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.day] })],
);
