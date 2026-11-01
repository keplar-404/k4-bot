import { relations } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { bot } from "./bot";

export const chatThread = pgTable(
  "chat_thread",
  {
    id: text("id").primaryKey(),
    botId: text("bot_id")
      .notNull()
      .references(() => bot.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New chat"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    archivedAt: timestamp("archived_at"),
  },
  (table) => [
    index("chat_thread_userId_idx").on(table.userId),
    index("chat_thread_botId_idx").on(table.botId),
    index("chat_thread_updatedAt_idx").on(table.updatedAt),
  ],
);

export const chatMessage = pgTable(
  "chat_message",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    // "user" | "assistant". parts is a list of {type:"text", text} blocks.
    role: text("role").notNull(),
    parts: jsonb("parts").notNull().$type<unknown>(),
    runId: text("run_id"),
    seq: bigint("seq", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("chat_message_threadId_seq_idx").on(table.threadId, table.seq),
  ],
);

export const chatEvent = pgTable(
  "chat_event",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    seq: bigint("seq", { mode: "number" }).notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().$type<unknown>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("chat_event_thread_seq_unique").on(table.threadId, table.seq),
  ],
);

export const agentUsage = pgTable(
  "agent_usage",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    runId: text("run_id").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("agent_usage_userId_createdAt_idx").on(table.userId, table.createdAt),
  ],
);

export const chatThreadRelations = relations(chatThread, ({ one, many }) => ({
  bot: one(bot, { fields: [chatThread.botId], references: [bot.id] }),
  messages: many(chatMessage),
}));

export const chatMessageRelations = relations(chatMessage, ({ one }) => ({
  thread: one(chatThread, {
    fields: [chatMessage.threadId],
    references: [chatThread.id],
  }),
}));

export type ChatThread = typeof chatThread.$inferSelect;
export type ChatMessage = typeof chatMessage.$inferSelect;
export type ChatEvent = typeof chatEvent.$inferSelect;
