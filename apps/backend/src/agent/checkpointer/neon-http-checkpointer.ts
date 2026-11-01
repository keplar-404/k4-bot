import {
  BaseCheckpointSaver,
  WRITES_IDX_MAP,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointPendingWrite,
  type CheckpointTuple,
  type PendingWrite,
} from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";
import { and, asc, desc, eq, lt, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Db } from "../../db";
import {
  checkpoint,
  checkpointBlobs,
  checkpointWrites,
} from "../../db/schema/checkpoint";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type CheckpointRow = typeof checkpoint.$inferSelect;
type Batch = [BatchItem<"pg">, ...BatchItem<"pg">[]];

// drizzle's batch() typing rejects insert builders that end in onConflict*,
// although they run fine; cast once here instead of at every call.
const asBatch = (queries: unknown[]) => queries as unknown as Batch;

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

  private static key(config: RunnableConfig) {
    const { thread_id, checkpoint_ns, checkpoint_id } = config.configurable ?? {};
    if (typeof thread_id !== "string" || !thread_id) {
      throw new Error("Missing thread_id in checkpointer config");
    }
    return {
      threadId: thread_id,
      ns: typeof checkpoint_ns === "string" ? checkpoint_ns : "",
      id: typeof checkpoint_id === "string" ? checkpoint_id : undefined,
    };
  }

  private async toTuple(row: CheckpointRow): Promise<CheckpointTuple> {
    const stored = JSON.parse(decoder.decode(row.checkpoint)) as Checkpoint;
    const versions = Object.entries(stored.channel_versions ?? {});

    const [blobs, writes] = await Promise.all([
      versions.length === 0
        ? []
        : this.db
            .select()
            .from(checkpointBlobs)
            .where(
              and(
                eq(checkpointBlobs.threadId, row.threadId),
                eq(checkpointBlobs.checkpointNs, row.checkpointNs),
                or(
                  ...versions.map(([channel, version]) =>
                    and(
                      eq(checkpointBlobs.channel, channel),
                      eq(checkpointBlobs.version, String(version)),
                    ),
                  ),
                ),
              ),
            ),
      this.db
        .select()
        .from(checkpointWrites)
        .where(
          and(
            eq(checkpointWrites.threadId, row.threadId),
            eq(checkpointWrites.checkpointNs, row.checkpointNs),
            eq(checkpointWrites.checkpointId, row.checkpointId),
          ),
        )
        .orderBy(
          asc(checkpointWrites.taskPath),
          asc(checkpointWrites.taskId),
          asc(checkpointWrites.idx),
        ),
    ]);

    const channel_values: Record<string, unknown> = {};
    for (const b of blobs) {
      if (b.blob !== null && b.type !== "empty") {
        channel_values[b.channel] = await this.serde.loadsTyped(b.type, new Uint8Array(b.blob));
      }
    }

    const pendingWrites: CheckpointPendingWrite[] = await Promise.all(
      writes.map(
        async (w) =>
          [
            w.taskId,
            w.channel,
            w.blob === null ? undefined : await this.serde.loadsTyped(w.type, new Uint8Array(w.blob)),
          ] as CheckpointPendingWrite,
      ),
    );

    const config = (id: string): RunnableConfig => ({
      configurable: { thread_id: row.threadId, checkpoint_ns: row.checkpointNs, checkpoint_id: id },
    });
    return {
      config: config(row.checkpointId),
      checkpoint: { ...stored, channel_values },
      metadata: (row.metadata as CheckpointMetadata | null) ?? undefined,
      parentConfig: row.parentCheckpointId ? config(row.parentCheckpointId) : undefined,
      pendingWrites,
    };
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const { threadId, ns, id } = NeonHttpCheckpointer.key(config);
    const [row] = await this.db
      .select()
      .from(checkpoint)
      .where(
        and(
          eq(checkpoint.threadId, threadId),
          eq(checkpoint.checkpointNs, ns),
          id ? eq(checkpoint.checkpointId, id) : undefined,
        ),
      )
      // Checkpoint ids are time-ordered (uuid6), so the newest sorts last.
      .orderBy(desc(checkpoint.checkpointId))
      .limit(1);
    return row ? this.toTuple(row) : undefined;
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions,
  ): AsyncGenerator<CheckpointTuple> {
    const { threadId, ns } = NeonHttpCheckpointer.key(config);
    const beforeId = options?.before?.configurable?.checkpoint_id;
    const rows = await this.db
      .select()
      .from(checkpoint)
      .where(
        and(
          eq(checkpoint.threadId, threadId),
          eq(checkpoint.checkpointNs, ns),
          typeof beforeId === "string" ? lt(checkpoint.checkpointId, beforeId) : undefined,
          ...Object.entries(options?.filter ?? {}).map(
            ([k, v]) => sql`${checkpoint.metadata} @> ${JSON.stringify({ [k]: v })}::jsonb`,
          ),
        ),
      )
      .orderBy(desc(checkpoint.checkpointId))
      .limit(options?.limit ?? 100);
    for (const row of rows) yield await this.toTuple(row);
  }

  async put(
    config: RunnableConfig,
    checkpointValue: Checkpoint,
    metadata: CheckpointMetadata,
    newVersions: Record<string, number | string>,
  ): Promise<RunnableConfig> {
    const { threadId, ns, id: parentId } = NeonHttpCheckpointer.key(config);

    const blobRows = await Promise.all(
      Object.entries(newVersions).map(async ([channel, version]) => {
        const value = checkpointValue.channel_values[channel];
        const [type, blob] =
          value === undefined ? (["empty", null] as const) : await this.serde.dumpsTyped(value);
        return { threadId, checkpointNs: ns, channel, version: String(version), type, blob };
      }),
    );

    const row = {
      threadId,
      checkpointNs: ns,
      checkpointId: checkpointValue.id,
      parentCheckpointId: parentId ?? null,
      type: "json",
      checkpoint: encoder.encode(JSON.stringify({ ...checkpointValue, channel_values: {} })),
      metadata: metadata as unknown,
    };

    // Blobs first, inside one transaction, so no checkpoint ever references a
    // value that was not stored.
    await this.db.batch(asBatch([
      ...(blobRows.length > 0
        ? [this.db.insert(checkpointBlobs).values(blobRows).onConflictDoNothing()]
        : []),
      this.db.insert(checkpoint).values(row).onConflictDoNothing(),
    ]));

    return {
      configurable: { thread_id: threadId, checkpoint_ns: ns, checkpoint_id: checkpointValue.id },
    };
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
    taskPath = "",
  ): Promise<void> {
    const { threadId, ns, id } = NeonHttpCheckpointer.key(config);
    if (!id) throw new Error("putWrites requires checkpoint_id in config");

    const rows = await Promise.all(
      writes.map(async ([channel, value], i) => {
        const [type, blob] = await this.serde.dumpsTyped(value);
        // Error/interrupt/resume writes have fixed negative slots and must
        // overwrite; ordinary writes are first-write-wins.
        const idx = WRITES_IDX_MAP[channel] ?? i;
        return { threadId, checkpointNs: ns, checkpointId: id, taskId, taskPath, idx, channel, type, blob };
      }),
    );
    const special = rows.filter((r) => r.idx < 0);
    const ordinary = rows.filter((r) => r.idx >= 0);

    const statements = [
      ...(ordinary.length > 0
        ? [this.db.insert(checkpointWrites).values(ordinary).onConflictDoNothing()]
        : []),
      ...(special.length > 0
        ? [
            this.db
              .insert(checkpointWrites)
              .values(special)
              .onConflictDoUpdate({
                target: [
                  checkpointWrites.threadId,
                  checkpointWrites.checkpointNs,
                  checkpointWrites.checkpointId,
                  checkpointWrites.taskId,
                  checkpointWrites.idx,
                ],
                set: {
                  channel: sql`excluded.channel`,
                  type: sql`excluded.type`,
                  blob: sql`excluded.blob`,
                },
              }),
          ]
        : []),
    ];
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
