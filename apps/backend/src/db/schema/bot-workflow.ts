import { boolean, index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { bot } from "./bot";
import { workflow } from "./workflow";

/** Which workflows a bot may see and run: the ones the user shared with it, plus the ones it created itself. */
export const botWorkflow = pgTable(
  "bot_workflow",
  {
    botId: text("bot_id")
      .notNull()
      .references(() => bot.id, { onDelete: "cascade" }),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflow.id, { onDelete: "cascade" }),
    /** True when the bot made the workflow (counts toward its daily creation cap). */
    createdByBot: boolean("created_by_bot").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.botId, t.workflowId] }), index("bot_workflow_wf_idx").on(t.workflowId)],
);
