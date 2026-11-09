import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { ScheduleConfig } from "../../modules/schedules/config";
import { user } from "./auth";
import { bot } from "./bot";
import { chatThread } from "./chat";

/**
 * A bot's scheduled task (like Grok's Tasks): at each due time the bot gets `prompt` as a new message in its chat, with
 * all its tools, and answers there. `threadId` is the chat the last run went to.
 */
export const botTask = pgTable(
  "scheduled_task",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => bot.id, { onDelete: "cascade" }),
    threadId: text("thread_id").references(() => chatThread.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    schedule: jsonb("schedule").$type<ScheduleConfig>().notNull(),
    status: text("status", { enum: ["active", "paused"] })
      .notNull()
      .default("active"),
    nextRunAt: timestamp("next_run_at"),
    lastRunAt: timestamp("last_run_at"),
    /** Why the last due run did not start (daily limit, the bot was still busy), shown on the task. */
    lastError: text("last_error"),
    createdByBot: boolean("created_by_bot").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("scheduled_task_user_idx").on(t.userId), index("scheduled_task_due_idx").on(t.status, t.nextRunAt)],
);

export type BotTask = typeof botTask.$inferSelect;
