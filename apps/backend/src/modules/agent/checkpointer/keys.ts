import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { BatchItem } from "drizzle-orm/batch";
import type { checkpoint } from "../../../db/schema/checkpoint";

export type CheckpointRow = typeof checkpoint.$inferSelect;
export type Serde = BaseCheckpointSaver["serde"];
export type Batch = [BatchItem<"pg">, ...BatchItem<"pg">[]];
export type CheckpointKey = { threadId: string; ns: string; id?: string };

// drizzle's batch() typing rejects insert builders that end in onConflict*,
// although they run fine; cast once here instead of at every call.
export const asBatch = (queries: unknown[]) => queries as unknown as Batch;

export function keyOf(config: RunnableConfig): CheckpointKey {
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
