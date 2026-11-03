import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { bot } from "./bot";
import { chatThread } from "./chat";

/**
 * A stored file: uploaded by the user, created by a bot (an image), or shared by a bot from the computer.
 * The bytes live in R2 (`storageKey`), so a download never needs the computer to be awake.
 * The file outlives its bot and chat (both links become null): it stays in the user's Files page.
 */
export const chatFile = pgTable(
  "chat_file",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The bot whose chat it came from (or that made it). */
    botId: text("bot_id").references(() => bot.id, { onDelete: "set null" }),
    threadId: text("thread_id").references(() => chatThread.id, { onDelete: "set null" }),
    /** "upload" | "generated" | "computer" */
    source: text("source").notNull(),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    storageKey: text("storage_key").notNull(),
    /** Where it is on the computer: the file it was shared from, or where a bot last copied it. */
    computerPath: text("computer_path"),
    /** The prompt of a created image. */
    prompt: text("prompt"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("chat_file_userId_createdAt_idx").on(table.userId, table.createdAt),
    index("chat_file_botId_idx").on(table.botId),
  ],
);

export type ChatFile = typeof chatFile.$inferSelect;
