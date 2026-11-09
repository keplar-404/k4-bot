import { bigint, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { workflow } from "./workflow";

/**
 * Calls to a workflow's webhook URL that reached it (right workflow id): accepted or refused, and why, so the user can
 * see who calls and debug a sender. The IP is stored as a hash only. Pruned after 7 days.
 */
export const webhookRequest = pgTable(
  "webhook_request",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflow.id, { onDelete: "cascade" }),
    status: integer("status").notNull(),
    reason: text("reason").notNull(),
    ipHash: text("ip_hash").notNull(),
    runId: text("run_id"),
    at: timestamp("at").defaultNow().notNull(),
  },
  (t) => [index("webhook_request_wf_idx").on(t.workflowId, t.at)],
);
