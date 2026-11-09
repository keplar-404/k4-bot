import { index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { bot } from "./bot";

/** A group chat of several of the user's bots. Un-mentioned messages go to the lead; `@bot:name` picks others. */
export const botGroup = pgTable(
  "bot_group",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Null when the lead was deleted: the first member then leads. */
    leadBotId: text("lead_bot_id").references(() => bot.id, { onDelete: "set null" }),
    /** Notes every member reads in this group (update_group_memory). */
    memory: text("memory").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("bot_group_userId_idx").on(t.userId)],
);

export const botGroupMember = pgTable(
  "bot_group_member",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => botGroup.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => bot.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.botId] }), index("bot_group_member_botId_idx").on(t.botId)],
);

/** What the admin bot changed, for the user to review. Kept with the user. */
export const adminAudit = pgTable(
  "admin_audit",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    botId: text("bot_id"),
    action: text("action").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("admin_audit_userId_idx").on(t.userId, t.createdAt)],
);

export type BotGroup = typeof botGroup.$inferSelect;
