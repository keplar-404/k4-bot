import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
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
    /** What the bot is for (an id from lib/bot-roles.ts); shapes its system prompt. */
    role: text("role").notNull().default("assistant"),
    /** The user's own role title when role is "custom". */
    roleTitle: text("role_title"),
    /** May spawn groups of sub-agents (spawn_subagents). New bots take their role's default (agent/domains). */
    subagentsEnabled: boolean("subagents_enabled").notNull().default(false),
    /** Largest sub-agent group, 1-20. */
    maxSubagents: integer("max_subagents").notNull().default(5),
    /** Tool calls run at the same time, 1-10. */
    maxParallelTools: integer("max_parallel_tools").notNull().default(5),
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