import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * One row per finished agent run: the model, how many slices and retries it took, and why it stopped.
 * Written by the run workflows themselves, so "it stopped for no reason" has an answer.
 */
export const runTrace = pgTable(
  "run_trace",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    runId: text("run_id").notNull(),
    threadId: text("thread_id"),
    userId: text("user_id").notNull(),
    modelId: text("model_id"),
    status: text("status").notNull(),
    slices: integer("slices").notNull().default(0),
    retries: integer("retries").notNull().default(0),
    stopReason: text("stop_reason"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
  },
  (table) => [index("run_trace_user_time_idx").on(table.userId, table.startedAt)],
);
