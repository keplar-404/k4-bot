import { sql } from "drizzle-orm";
import type { Db } from "../../../db";
import { chatMessage } from "../../../db/schema";
import type { Env } from "../../../config/env";
import type { Part } from "../../agent/parts";
import { nextMessageSeq } from "../threads";
import type { ChatRunParams } from "./types";

/** Sends one event to the thread's ChatRelay, which numbers, saves and broadcasts it. */
export async function publishEvent(env: Env, threadId: string, type: string, payload: object) {
  const stub = env.CHAT_RELAY.get(env.CHAT_RELAY.idFromName(threadId));
  const response = await stub.fetch("https://relay/publish", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": env.WS_TOKEN_SECRET ?? env.BETTER_AUTH_SECRET,
    },
    body: JSON.stringify({ threadId, type, payload }),
  });
  if (!response.ok) console.error("[chat-run] publish failed", type, response.status);
}

/** Appends finished parts to this run's assistant message, creating it on first use. */
export async function appendParts(db: Db, params: ChatRunParams, parts: Part[]) {
  await db
    .insert(chatMessage)
    .values({
      id: `${params.runId}:assistant`,
      threadId: params.threadId,
      role: "assistant",
      parts,
      runId: params.runId,
      seq: nextMessageSeq(params.threadId),
    })
    // jsonb array concatenation: the message grows as the run goes on, across slices.
    .onConflictDoUpdate({ target: chatMessage.id, set: { parts: sql`${chatMessage.parts} || excluded.parts` } });
}
