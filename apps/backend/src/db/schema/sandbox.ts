import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { bot } from "./bot";

/** A bot's code sandbox (E2B). The primary key makes it one per bot; the BotSandbox Durable Object owns it. */
export const botSandbox = pgTable(
  "bot_sandbox",
  {
    botId: text("bot_id").primaryKey().references(() => bot.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    sandboxId: text("sandbox_id").notNull(),
    status: text("status").notNull().default("creating"),
    purpose: text("purpose").notNull(),
    template: text("template").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
    lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
    /** Running time today (UTC day `usageDay`), summed over the user's sandboxes for the daily cap. */
    usageDay: text("usage_day"),
    usageSeconds: integer("usage_seconds").notNull().default(0),
  },
  (table) => [index("bot_sandbox_userId_idx").on(table.userId)],
);

export type BotSandboxRow = typeof botSandbox.$inferSelect;

/**
 * Sandbox time used outside a bot's own sandbox (a workflow's Code block). Counts toward the same daily sandbox
 * budget (SANDBOX_MAX_MINUTES_PER_DAY). Kept with the user, like usage rows: deleting a workflow gives no time back.
 */
export const sandboxUsage = pgTable(
  "sandbox_usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    /** YYYY-MM-DD (UTC), the same day key as bot_sandbox.usage_day. */
    day: text("day").notNull(),
    seconds: integer("seconds").notNull(),
    /** What used it: "workflow:<runId>". */
    source: text("source").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("sandbox_usage_user_day_idx").on(t.userId, t.day)],
);
