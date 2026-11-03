import {
  BaseCheckpointSaver,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointTuple,
  type PendingWrite,
} from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { Db } from "../../../db";
import { checkpoint, checkpointBlobs, checkpointWrites } from "../../../db/schema/checkpoint";
import { asBatch, keyOf } from "./keys";
import { toTuple } from "./read";
import { checkpointStatements, writeStatements } from "./write";

/**
 * LangGraph checkpointer over the Neon HTTP driver (Drizzle).
 *
 * The stock PostgresSaver needs a raw TCP socket, which Cloudflare Workers
 * cannot hold open. The layout is the upstream one: the `checkpoints` row holds
 * the checkpoint without channel values, and each channel value is a row in
 * `checkpoint_blobs` keyed by (channel, version). A checkpoint therefore
 * reloads exactly the versions it references. Multi-statement writes go through
 * `db.batch`, which Neon runs as one transaction.
 */
export class NeonHttpCheckpointer extends BaseCheckpointSaver {
  constructor(private readonly db: Db) {
    super();
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const { threadId, ns, id } = keyOf(config);
    const [row] = await this.db
      .select()
      .from(checkpoint)
      .where(and(eq(checkpoint.threadId, threadId), eq(checkpoint.checkpointNs, ns), id ? eq(checkpoint.checkpointId, id) : undefined))
      // Checkpoint ids are time-ordered (uuid6), so the newest sorts last.
      .orderBy(desc(checkpoint.checkpointId))
      .limit(1);
    return row ? toTuple(this.db, this.serde, row) : undefined;
  }

  async *list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
    const { threadId, ns } = keyOf(config);
    const beforeId = options?.before?.configurable?.checkpoint_id;
    const rows = await this.db
      .select()
      .from(checkpoint)
      .where(
        and(
          eq(checkpoint.threadId, threadId),
          eq(checkpoint.checkpointNs, ns),
          typeof beforeId === "string" ? lt(checkpoint.checkpointId, beforeId) : undefined,
          ...Object.entries(options?.filter ?? {}).map(([k, v]) => sql`${checkpoint.metadata} @> ${JSON.stringify({ [k]: v })}::jsonb`),
        ),
      )
      .orderBy(desc(checkpoint.checkpointId))
      .limit(options?.limit ?? 100);
    for (const row of rows) yield await toTuple(this.db, this.serde, row);
  }

  async put(config: RunnableConfig, value: Checkpoint, metadata: CheckpointMetadata, newVersions: Record<string, number | string>): Promise<RunnableConfig> {
    const key = keyOf(config);
    // Blobs first, inside one transaction, so no checkpoint ever references a
    // value that was not stored.
    await this.db.batch(asBatch(await checkpointStatements(this.db, this.serde, key, value, metadata, newVersions)));
    return { configurable: { thread_id: key.threadId, checkpoint_ns: key.ns, checkpoint_id: value.id } };
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string, taskPath = ""): Promise<void> {
    const key = keyOf(config);
    if (!key.id) throw new Error("putWrites requires checkpoint_id in config");
    const statements = await writeStatements(this.db, this.serde, { ...key, id: key.id }, writes, taskId, taskPath);
    if (statements.length > 0) await this.db.batch(asBatch(statements));
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.db.batch([
      this.db.delete(checkpointWrites).where(eq(checkpointWrites.threadId, threadId)),
      this.db.delete(checkpointBlobs).where(eq(checkpointBlobs.threadId, threadId)),
      this.db.delete(checkpoint).where(eq(checkpoint.threadId, threadId)),
    ]);
  }
}
