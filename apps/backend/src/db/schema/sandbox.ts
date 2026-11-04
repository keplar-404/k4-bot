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
