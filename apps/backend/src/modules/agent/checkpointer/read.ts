import type { Checkpoint, CheckpointMetadata, CheckpointPendingWrite, CheckpointTuple } from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";
import { and, asc, eq, or } from "drizzle-orm";
import type { Db } from "../../../db";
import { checkpointBlobs, checkpointWrites } from "../../../db/schema/checkpoint";
import type { CheckpointRow, Serde } from "./keys";

const decoder = new TextDecoder();

/** A stored checkpoint row as LangGraph's tuple: its channel values (the exact versions it references) and pending writes. */
export async function toTuple(db: Db, serde: Serde, row: CheckpointRow): Promise<CheckpointTuple> {
  const stored = JSON.parse(decoder.decode(row.checkpoint)) as Checkpoint;
  const versions = Object.entries(stored.channel_versions ?? {});

  const [blobs, writes] = await Promise.all([
    versions.length === 0
      ? []
      : db
          .select()
          .from(checkpointBlobs)
          .where(
            and(
              eq(checkpointBlobs.threadId, row.threadId),
              eq(checkpointBlobs.checkpointNs, row.checkpointNs),
              or(...versions.map(([channel, version]) => and(eq(checkpointBlobs.channel, channel), eq(checkpointBlobs.version, String(version))))),
            ),
          ),
    db
      .select()
      .from(checkpointWrites)
      .where(
        and(
          eq(checkpointWrites.threadId, row.threadId),
          eq(checkpointWrites.checkpointNs, row.checkpointNs),
          eq(checkpointWrites.checkpointId, row.checkpointId),
        ),
      )
      .orderBy(asc(checkpointWrites.taskPath), asc(checkpointWrites.taskId), asc(checkpointWrites.idx)),
  ]);

  const channel_values: Record<string, unknown> = {};
  for (const b of blobs) {
    if (b.blob !== null && b.type !== "empty") {
      channel_values[b.channel] = await serde.loadsTyped(b.type, new Uint8Array(b.blob));
    }
  }

  const pendingWrites: CheckpointPendingWrite[] = await Promise.all(
    writes.map(
      async (w) =>
        [w.taskId, w.channel, w.blob === null ? undefined : await serde.loadsTyped(w.type, new Uint8Array(w.blob))] as CheckpointPendingWrite,
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
