import { eq } from "drizzle-orm";
import type { Env } from "../../config/env";
import type { Db } from "../../db";
import { chatMessage } from "../../db/schema";
import type { ToolPart } from "../agent/parts";
import { publishEvent, stopRequested } from "../chat/run/relay";
import type { ChatRunParams, GroupTurn } from "../chat/run/types";
import { nextMessageSeq } from "../chat/threads";
import { memberNamed } from "./mentions";
import { groupMembers } from "./store";
import { MESSAGE_BOT, messageBotSchema } from "./tools";

/** Bot-to-bot hand-offs per user message: a loop guard (each hand-off is a paid run). */
export const MAX_HOPS = 8;

/** A stable run id for the turn after `runId`: a retried step finds the run it already started. */
async function nextRunId(runId: string) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${runId}:next`)));
  const hex = [...hash.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** The hand-offs this turn made with message_bot, read back from its saved tool calls. */
export function handoffsOf(parts: unknown, members: Array<{ id: string; name: string }>, self: { id: string; name: string }): GroupTurn[] {
  const calls = (Array.isArray(parts) ? parts : []).filter((p): p is ToolPart => p?.type === "tool" && p.name === MESSAGE_BOT && p.status === "done");
  return calls.flatMap((call) => {
    let input: unknown;
    try {
      input = JSON.parse(call.input);
    } catch {
      return [];
    }
    const parsed = messageBotSchema.safeParse(input);
    const target = parsed.success ? memberNamed(members, parsed.data.bot) : undefined;
    if (!parsed.success || !target || target.id === self.id) return [];
    return [{ botId: target.id, task: parsed.data.text, from: self.name, fileIds: parsed.data.fileIds }];
  });
}

/** What a queued member is told (quoted, never a "Name:" line, which providers read as a role delimiter). */
/**
 * The turns still to come: hand-offs first, then the user's queued mentions. A hand-off to a bot that already has a
 * turn coming joins that turn (one more line of what it is asked) instead of making it answer twice.
 */
export function mergeTurns(handoffs: GroupTurn[], queued: GroupTurn[]): GroupTurn[] {
  const out = queued.map((t) => ({ ...t }));
  const fresh: GroupTurn[] = [];
  for (const h of handoffs) {
    const same = out.find((t) => t.botId === h.botId) ?? fresh.find((t) => t.botId === h.botId);
    if (same) {
      same.task = `${same.task ?? ""}\n\nAlso, ${h.from} asks you: ${h.task ?? ""}`.trim();
      same.fileIds = [...(same.fileIds ?? []), ...(h.fileIds ?? [])];
    } else fresh.push({ ...h });
  }
  return [...fresh, ...out];
}

export const turnContent = (t: GroupTurn) =>
  t.from === "User" || !t.from ? `The user wrote, quoted: «${t.task ?? ""}»` : `${t.from} asks you, quoted: «${t.task ?? ""}»`;

/**
 * After a member's turn: the next queued member answers, in a new run of its own (hand-offs from this turn first,
 * then the bots the user mentioned). Its assistant message is created now, so the thread counts as busy from here.
 */
export async function startNextTurn(env: Env, db: Db, params: ChatRunParams, self: { id: string; name: string; groupId: string }) {
  if (await stopRequested(env, params.threadId, params.runId).catch(() => false)) return null;
  const members = await groupMembers(db, self.groupId);
  const [mine] = await db.select({ parts: chatMessage.parts }).from(chatMessage).where(eq(chatMessage.id, `${params.runId}:assistant`)).limit(1);
  const hops = params.hops ?? 0;
  const handoffs = handoffsOf(mine?.parts, members, self);
  const allowed = handoffs.slice(0, Math.max(0, MAX_HOPS - hops));
  if (allowed.length < handoffs.length) {
    await publishEvent(env, params.threadId, "group.notice", { text: `Stopped passing work between bots after ${MAX_HOPS} hand-offs. Send a message to carry on.` });
  }
  const queue = mergeTurns(allowed, params.queue ?? []).filter((t) => members.some((m) => m.id === t.botId));
  const next = queue[0];
  if (!next) return null;

  const runId = await nextRunId(params.runId);
  await db
    .insert(chatMessage)
    .values({ id: `${runId}:assistant`, threadId: params.threadId, role: "assistant", parts: [], runId, authorBotId: next.botId, seq: nextMessageSeq(params.threadId) })
    .onConflictDoNothing();
  const nextParams: ChatRunParams = {
    ...params,
    runId,
    botId: next.botId,
    queue: queue.slice(1),
    hops: hops + allowed.length,
    chained: true,
    content: turnContent(next),
    fileIds: next.fileIds,
    compact: undefined,
    research: undefined,
  };
  await env.CHAT_RUN.create({ id: runId, params: nextParams }).catch(async (error) => {
    if (!(await env.CHAT_RUN.get(runId).catch(() => null))) throw error;
  });
  await publishEvent(env, params.threadId, "run.started", { runId, botId: next.botId });
  return runId;
}
