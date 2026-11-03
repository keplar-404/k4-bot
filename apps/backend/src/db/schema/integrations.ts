import { index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { bot } from "./bot";

/** A skill a user installed from the catalog. The files are a pinned snapshot in R2 (`storageKey`). */
export const userSkill = pgTable(
  "user_skill",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Catalog id (skills.sh "<owner>/<repo>/<skill>"). */
    skillId: text("skill_id").notNull(),
    /** The skill's own name (its SKILL.md frontmatter); also its folder for the agent. */
    name: text("name").notNull(),
    description: text("description").notNull(),
    /** SHA-256 of the snapshot as skills.sh reports it: shows when an update is available. */
    hash: text("hash"),
    /** Content-addressed, so users who install the same version share one object. */
    storageKey: text("storage_key").notNull(),
    fileCount: integer("file_count").notNull(),
    size: integer("size").notNull(),
    installedAt: timestamp("installed_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("user_skill_user_skill_unique").on(table.userId, table.skillId)],
);

/** An MCP server a user connected. `secrets` is AES-256-GCM ciphertext (lib/secrets.ts), never the clear value. */
export const userMcpServer = pgTable(
  "user_mcp_server",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Catalog id ("airtable", "shadcn"). */
    serverId: text("server_id").notNull(),
    /** Encrypted JSON of the secret fields; null when the server needs none. */
    secrets: text("secrets"),
    /** Last characters of the main secret, so the UI can say which token is saved. */
    secretHint: text("secret_hint"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("user_mcp_server_user_server_unique").on(table.userId, table.serverId)],
);

/** Which installed skills a bot uses. */
export const botSkill = pgTable(
  "bot_skill",
  {
    botId: text("bot_id")
      .notNull()
      .references(() => bot.id, { onDelete: "cascade" }),
    userSkillId: text("user_skill_id")
      .notNull()
      .references(() => userSkill.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.botId, table.userSkillId] }), index("bot_skill_userSkillId_idx").on(table.userSkillId)],
);

/** Which connected MCP servers a bot may use. */
export const botMcpServer = pgTable(
  "bot_mcp_server",
  {
    botId: text("bot_id")
      .notNull()
      .references(() => bot.id, { onDelete: "cascade" }),
    userMcpServerId: text("user_mcp_server_id")
      .notNull()
      .references(() => userMcpServer.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.botId, table.userMcpServerId] }), index("bot_mcp_server_userMcpServerId_idx").on(table.userMcpServerId)],
);

export type UserSkill = typeof userSkill.$inferSelect;
export type UserMcpServer = typeof userMcpServer.$inferSelect;
