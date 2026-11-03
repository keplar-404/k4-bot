import { type Checkpoint, type CheckpointMetadata, type PendingWrite, WRITES_IDX_MAP } from "@langchain/langgraph-checkpoint";
import { sql } from "drizzle-orm";
import type { Db } from "../../../db";
import { checkpoint, checkpointBlobs, checkpointWrites } from "../../../db/schema/checkpoint";
import type { CheckpointKey, Serde } from "./keys";

const encoder = new TextEncoder();

/** The statements that store one checkpoint: its new channel values (blobs) first, then the checkpoint row. */
export async function checkpointStatements(db: Db, serde: Serde, key: CheckpointKey, value: Checkpoint, metadata: CheckpointMetadata, newVersions: Record<string, number | string>) {
  const { threadId, ns, id: parentId } = key;
  const blobRows = await Promise.all(
    Object.entries(newVersions).map(async ([channel, version]) => {
      const channelValue = value.channel_values[channel];
      const [type, blob] = channelValue === undefined ? (["empty", null] as const) : await serde.dumpsTyped(channelValue);
      return { threadId, checkpointNs: ns, channel, version: String(version), type, blob };
    }),
  );
  const row = {
    threadId,
    checkpointNs: ns,
    checkpointId: value.id,
    parentCheckpointId: parentId ?? null,
    type: "json",
    checkpoint: encoder.encode(JSON.stringify({ ...value, channel_values: {} })),
    metadata: metadata as unknown,
  };
  return [
    ...(blobRows.length > 0 ? [db.insert(checkpointBlobs).values(blobRows).onConflictDoNothing()] : []),
    db.insert(checkpoint).values(row).onConflictDoNothing(),
  ];
}

/** The statements that store a task's pending writes. */
export async function writeStatements(db: Db, serde: Serde, key: CheckpointKey & { id: string }, writes: PendingWrite[], taskId: string, taskPath: string) {
  const rows = await Promise.all(
    writes.map(async ([channel, value], i) => {
      const [type, blob] = await serde.dumpsTyped(value);
      // Error/interrupt/resume writes have fixed negative slots and must
      // overwrite; ordinary writes are first-write-wins.
      const idx = WRITES_IDX_MAP[channel] ?? i;
      return { threadId: key.threadId, checkpointNs: key.ns, checkpointId: key.id, taskId, taskPath, idx, channel, type, blob };
    }),
  );
  const special = rows.filter((r) => r.idx < 0);
  const ordinary = rows.filter((r) => r.idx >= 0);
  return [
    ...(ordinary.length > 0 ? [db.insert(checkpointWrites).values(ordinary).onConflictDoNothing()] : []),
    ...(special.length > 0
      ? [
          db
            .insert(checkpointWrites)
            .values(special)
            .onConflictDoUpdate({
              target: [checkpointWrites.threadId, checkpointWrites.checkpointNs, checkpointWrites.checkpointId, checkpointWrites.taskId, checkpointWrites.idx],
              set: { channel: sql`excluded.channel`, type: sql`excluded.type`, blob: sql`excluded.blob` },
            }),
        ]
      : []),
  ];
}
