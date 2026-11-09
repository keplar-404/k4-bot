import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { bot } from "./bot";
import { botGroup } from "./group";

/**
 * One bot's long-term memory: notes it keeps across all of its chats. Only that bot reads or writes it (no other
 * bot sees it). The bot rewrites it with `update_memory`; the user can view and edit it.
 */
export const botMemory = pgTable("bot_memory", {
  botId: text("bot_id")
    .primaryKey()
    .references(() => bot.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/**
 * The user's global preferences (name, language, tone, formats…), shared by all of their bots. Bots update them
 * with `update_user_preferences`; the user can view and edit them.
 */
export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/**
 * An automatic memory update (after a chat turn), with what the memory was before: the chat shows "Memory updated"
 * with Undo, and Undo restores `before` if nothing changed it since. Kept 30 days.
 */
export const memoryEvent = pgTable("memory_event", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Set for a bot's memory; null for the user's global preferences. */
  botId: text("bot_id").references(() => bot.id, { onDelete: "cascade" }),
  /** Set for a group's shared notes (scope "group"). */
  groupId: text("group_id").references(() => botGroup.id, { onDelete: "cascade" }),
  scope: text("scope", { enum: ["bot", "preferences", "group"] }).notNull(),
  before: text("before").notNull(),
  after: text("after").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
