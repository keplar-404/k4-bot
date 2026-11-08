import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const userSecret = pgTable(
  "user_secret",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    label: text("label").notNull().default(""),
    value: text("value").notNull(),
    hint: text("hint"),
    createdByBotId: text("created_by_bot_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("user_secret_user_name_unique").on(t.userId, t.name),
    index("user_secret_userId_idx").on(t.userId),
  ],
);

export type UserSecret = typeof userSecret.$inferSelect;
