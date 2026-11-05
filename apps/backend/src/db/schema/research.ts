import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { chatThread } from "./chat";
import { chatFile } from "./file";

/**
 * Tavily research tasks (/deep-research), one per thread and exact request. The request id is saved before polling,
 * so a retried or repeated run resumes the same paid task instead of starting a second one; the finished report is a
 * stored file (`fileId`), so it survives the model's context limits and can be re-read later with read_document.
 */
export const researchTask = pgTable(
  "research_task",
  {
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    /** sha-256 of the research arguments: the same question with the same options is the same task. */
    inputHash: text("input_hash").notNull(),
    userId: text("user_id").notNull(),
    requestId: text("request_id").notNull(),
    status: text("status", { enum: ["pending", "completed", "failed"] }).notNull().default("pending"),
    fileId: text("file_id").references(() => chatFile.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.threadId, t.inputHash] })],
);
