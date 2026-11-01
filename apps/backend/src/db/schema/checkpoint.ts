import { customType, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

// Neon serverless returns bytea as Uint8Array.
export const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

/**
 * LangGraph checkpoint tables. Column names follow the upstream Postgres saver;
 * the checkpoint JSON is stored as UTF-8 bytes in a bytea column.
 */
export const checkpoint = pgTable(
  "checkpoints",
  {
    threadId: text("thread_id").notNull(),
    checkpointNs: text("checkpoint_ns").notNull().default(""),
    checkpointId: text("checkpoint_id").notNull(),
    parentCheckpointId: text("parent_checkpoint_id"),
    type: text("type"),
    checkpoint: bytea("checkpoint").notNull(),
    metadata: jsonb("metadata").$type<unknown>(),
    ts: timestamp("ts", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.threadId, table.checkpointNs, table.checkpointId],
    }),
    index("checkpoints_thread_id_idx").on(table.threadId),
  ],
);

export const checkpointBlobs = pgTable(
  "checkpoint_blobs",
  {
    threadId: text("thread_id").notNull(),
    checkpointNs: text("checkpoint_ns").notNull().default(""),
    channel: text("channel").notNull(),
    version: text("version").notNull(),
    type: text("type").notNull(),
    blob: bytea("blob"),
  },
  (table) => [
    primaryKey({
      columns: [
        table.threadId,
        table.checkpointNs,
        table.channel,
        table.version,
      ],
    }),
    index("checkpoint_blobs_thread_idx").on(table.threadId),
  ],
);

export const checkpointWrites = pgTable(
  "checkpoint_writes",
  {
    threadId: text("thread_id").notNull(),
    checkpointNs: text("checkpoint_ns").notNull().default(""),
    checkpointId: text("checkpoint_id").notNull(),
    taskId: text("task_id").notNull(),
    taskPath: text("task_path").notNull().default(""),
    idx: integer("idx").notNull(),
    channel: text("channel").notNull(),
    type: text("type").notNull(),
    blob: bytea("blob"),
  },
  (table) => [
    primaryKey({
      columns: [
        table.threadId,
        table.checkpointNs,
        table.checkpointId,
        table.taskId,
        table.idx,
      ],
    }),
    index("checkpoint_writes_thread_idx").on(table.threadId),
  ],
);
