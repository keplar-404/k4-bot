import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const bot = pgTable(
  "bot",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    shape: text("shape").notNull(),
    color: text("color").notNull(),
    expression: text("expression").notNull(),
    /** The model the user last picked for this bot (an OpenRouter id from the catalog). Null = the default. */
    modelId: text("model_id"),
    /** Reasoning level picked with that model; null when the model has none. */
    reasoningEffort: text("reasoning_effort"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("bot_userId_idx").on(table.userId)],
);

export const botRelations = relations(bot, ({ one }) => ({
  user: one(user, {
    fields: [bot.userId],
    references: [user.id],
  }),
}));

export type Bot = typeof bot.$inferSelect;
export type NewBot = typeof bot.$inferInsert;