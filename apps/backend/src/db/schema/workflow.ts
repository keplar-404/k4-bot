import { bigint, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { WorkflowGraph } from "../../modules/workflows/graph/schema";
import { user } from "./auth";

/**
 * A user's workflow (Zapier's Zap, n8n's workflow). `graph` is the draft being edited; `publishedGraph` is the copy
 * that runs once the workflow is active, so editing never changes a live workflow until it is published again.
 */
export const workflow = pgTable(
  "workflow",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status", { enum: ["draft", "active", "paused"] })
      .notNull()
      .default("draft"),
    graph: jsonb("graph").$type<WorkflowGraph>().notNull(),
    publishedGraph: jsonb("published_graph").$type<WorkflowGraph | null>(),
    publishedVersion: integer("published_version").notNull().default(0),
    /** Trigger of the published graph ("trigger.manual" | "trigger.schedule" | "trigger.webhook"), for lists and the cron. */
    triggerKind: text("trigger_kind"),
    /** When a scheduled workflow is due next (the per-minute cron starts it). */
    nextRunAt: timestamp("next_run_at"),
    /** sha-256 of the webhook trigger's secret token (the token itself is shown once and never stored). */
    webhookTokenHash: text("webhook_token_hash"),
    /** The Composio trigger instance (ti_…) an app-event trigger listens on, while the workflow is on. */
    composioTriggerId: text("composio_trigger_id"),
    /** Why the system turned it off (an app connection expired, it kept starting itself), shown until it is on again. */
    pausedReason: text("paused_reason"),
    lastRunAt: timestamp("last_run_at"),
    /** The workflow assistant run editing this workflow right now: the canvas is read-only for the user meanwhile. */
    assistantRunId: text("assistant_run_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("workflow_user_idx").on(t.userId, t.updatedAt),
    index("workflow_due_idx").on(t.status, t.nextRunAt),
    index("workflow_composio_trigger_idx").on(t.composioTriggerId),
  ],
);

/** One execution of a workflow, and how it ended. */
export const workflowRun = pgTable(
  "workflow_run",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflow.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    version: integer("version").notNull(),
    trigger: text("trigger", { enum: ["manual", "test", "schedule", "webhook", "bot", "app"] }).notNull(),
    /** The bot that started this run, for the per-bot hourly cap and the run history. */
    startedByBotId: text("started_by_bot_id"),
    status: text("status", { enum: ["queued", "running", "succeeded", "failed", "cancelled"] })
      .notNull()
      .default("queued"),
    /** The graph this run executes (a test run uses the draft, others the published copy). */
    graph: jsonb("graph").$type<WorkflowGraph>().notNull(),
    input: jsonb("input").$type<unknown>(),
    error: text("error"),
    failedNodeId: text("failed_node_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
  },
  (t) => [
    index("workflow_run_wf_idx").on(t.workflowId, t.createdAt),
    index("workflow_run_user_idx").on(t.userId, t.createdAt),
    index("workflow_run_bot_idx").on(t.startedByBotId, t.createdAt),
  ],
);

/** One block of one run: what went in, what came out, how many tries, and the exact error when it failed. */
export const workflowRunStep = pgTable(
  "workflow_run_step",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    runId: text("run_id")
      .notNull()
      .references(() => workflowRun.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(),
    nodeKind: text("node_kind").notNull(),
    status: text("status", {
      enum: ["running", "retrying", "succeeded", "failed", "skipped", "waiting"],
    }).notNull(),
    attempt: integer("attempt").notNull().default(1),
    input: jsonb("input").$type<unknown>(),
    output: jsonb("output").$type<unknown>(),
    error: text("error"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
  },
  (t) => [uniqueIndex("workflow_run_step_unique").on(t.runId, t.nodeId)],
);

/**
 * Composio delivers trigger events at least once: each event id is kept for a week, so a redelivered event never
 * starts its workflows twice.
 */
export const composioEvent = pgTable("composio_event", {
  id: text("id").primaryKey(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});
