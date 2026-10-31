import { pgTable, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export const apiRateLimit = pgTable(
  "api_rate_limit",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    count: integer("count").notNull().default(0),
    windowStart: timestamp("window_start").notNull(),
  },
  (table) => [
    uniqueIndex("rate_limit_key_idx").on(table.key),
    index("rate_limit_window_start_idx").on(table.windowStart),
  ],
);

export type ApiRateLimitRow = typeof apiRateLimit.$inferSelect;
