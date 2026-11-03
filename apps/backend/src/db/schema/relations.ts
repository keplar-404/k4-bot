import { relations } from "drizzle-orm";
import { account, session, user } from "./auth";
import { bot } from "./bot";
import { chatMessage, chatThread } from "./chat";

/** Drizzle query relations (they add no SQL: the foreign keys live in the tables). */

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const botRelations = relations(bot, ({ one }) => ({
  user: one(user, {
    fields: [bot.userId],
    references: [user.id],
  }),
}));

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
