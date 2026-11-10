import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { bot } from "./bot";

/**
 * Composio's app catalog (~1,700 toolkits), copied from `composio.toolkits.get()` once a day by the cron. The Connect
 * page and the workflow builder search and filter it here, so a page view costs one query instead of dozens of
 * Composio calls. Shared by all users: it holds no user data.
 */
export const composioToolkit = pgTable(
  "composio_toolkit",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** https://logos.composio.dev/api/<slug> */
    logo: text("logo"),
    /** Category slugs and names, from the toolkit's own `meta.categories`. */
    categories: jsonb("categories").$type<Array<{ slug: string; name: string }>>().notNull().default([]),
    toolsCount: integer("tools_count").notNull().default(0),
    triggersCount: integer("triggers_count").notNull().default(0),
    /** True for toolkits that need no account (connecting is not required). */
    noAuth: boolean("no_auth").notNull().default(false),
    /** How the app signs in (Composio's `auth_schemes`: "OAUTH2", "API_KEY", "BEARER_TOKEN", "BASIC"…). */
    authSchemes: jsonb("auth_schemes").$type<string[]>().notNull().default([]),
    /** Composio's popularity order (0 = most used): the default sort. */
    rank: integer("rank").notNull(),
    syncedAt: timestamp("synced_at").defaultNow().notNull(),
  },
  (t) => [index("composio_toolkit_rank_idx").on(t.rank)],
);

/** Which Composio apps a bot may use. */
export const botComposioApp = pgTable(
  "bot_composio_app",
  {
    botId: text("bot_id")
      .notNull()
      .references(() => bot.id, { onDelete: "cascade" }),
    toolkit: text("toolkit").notNull(),
    connectedAccountId: text("connected_account_id"),
    allowWrites: boolean("allow_writes").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.botId, t.toolkit] }), index("bot_composio_app_botId_idx").on(t.botId)],
);
