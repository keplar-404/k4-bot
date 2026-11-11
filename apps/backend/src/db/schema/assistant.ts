import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { Part } from "../../modules/agent/parts";
import { user } from "./auth";
import { workflow } from "./workflow";

/** One step of the assistant's plan, as the chat shows it (its to-do list). */
export type AssistantTodo = { content: string; status: "pending" | "in_progress" | "completed" };

/**
 * The workflow builder's assistant chat: one history per user across all workflows. `workflowId` is the workflow the
 * conversation is about now (it follows the page the user writes from).
 */
export const assistantThread = pgTable(
  "assistant_thread",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New chat"),
    workflowId: text("workflow_id").references(() => workflow.id, { onDelete: "set null" }),
    modelId: text("model_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("assistant_thread_user_idx").on(t.userId, t.updatedAt)],
);

/** What the user wrote, and the assistant's final answers (with the to-do list as it ended). Never tool calls. */
export const assistantMessage = pgTable(
  "assistant_message",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => assistantThread.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    /** User uploads: stored file ids, names and types. */
    files: jsonb("files").$type<Array<{ id: string; name: string; mimeType: string }>>().notNull().default([]),
    todos: jsonb("todos").$type<AssistantTodo[]>().notNull().default([]),
    /** The whole turn as the chat shows it: reasoning, tool calls and text (the same parts as a bot chat). */
    parts: jsonb("parts").$type<Part[]>().notNull().default([]),
    runId: text("run_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("assistant_message_thread_idx").on(t.threadId, t.createdAt)],
);

/** One assistant turn running in the cloud (a Cloudflare Workflow instance with the same id). */
export const assistantRun = pgTable(
  "assistant_run",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => assistantThread.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    workflowId: text("workflow_id").notNull(),
    status: text("status", { enum: ["queued", "running", "waiting", "succeeded", "failed", "cancelled"] })
      .notNull()
      .default("queued"),
    todos: jsonb("todos").$type<AssistantTodo[]>().notNull().default([]),
    /** The turn so far, saved as it grows: a reopened page shows it and the run goes on from it. */
    parts: jsonb("parts").$type<Part[]>().notNull().default([]),
    /** While `waiting`: what the user must answer (connect apps, confirm turning on…), shown as a card. */
    question: jsonb("question").$type<Record<string, unknown> | null>(),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
  },
  (t) => [
    index("assistant_run_user_idx").on(t.userId, t.status),
    index("assistant_run_thread_idx").on(t.threadId, t.createdAt),
    // One working run per user, enforced by the database: two messages sent at the same instant cannot both start.
    uniqueIndex("assistant_run_one_active")
      .on(t.userId)
      .where(sql`${t.status} in ('queued', 'running', 'waiting')`),
  ],
);

/** What the assistant remembers about the user (preferences), across workflows. */
export const assistantMemory = pgTable("assistant_memory", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
