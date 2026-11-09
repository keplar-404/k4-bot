import { and, desc, eq, gt, max, ne } from "drizzle-orm";
import type { Db } from "../../db";
import { chatMessage, chatThread } from "../../db/schema";
import type { ChatRunParams } from "../chat/run/types";
import { mentionKey } from "./mentions";
import { getOwnedGroup, type GroupMember, groupMembers, leadOf } from "./store";

const MAX_LINES = 30;
const MAX_LINE_CHARS = 1500;

type Row = { role: string; parts: unknown; authorBotId: string | null };

function textOf(row: Row): string {
  const parts = Array.isArray(row.parts) ? (row.parts as Array<{ type?: string; text?: string; file?: { name?: string; id?: string } }>) : [];
  const text = parts.flatMap((p) => (p.type === "text" && p.text ? [p.text] : p.type === "file" && p.file ? [`[file "${p.file.name}" id ${p.file.id}]`] : [])).join(" ");
  return text.length > MAX_LINE_CHARS ? `${text.slice(0, MAX_LINE_CHARS)}…` : text;
}

/** The group chat around one bot's turn: its group, the members, and what to send the model this turn. */
export async function groupTurn(db: Db, params: ChatRunParams, botId: string) {
  const [thread] = await db.select({ groupId: chatThread.groupId }).from(chatThread).where(eq(chatThread.id, params.threadId)).limit(1);
  const group = thread?.groupId ? await getOwnedGroup(db, params.userId, thread.groupId) : null;
  if (!group) return null;
  const members = await groupMembers(db, group.id);
  const lead = leadOf(group, members);
  const me = members.find((m) => m.id === botId);
  const [mine] = await db
    .select({ seq: max(chatMessage.seq) })
    .from(chatMessage)
    .where(and(eq(chatMessage.threadId, params.threadId), eq(chatMessage.authorBotId, botId)));
  const rows = await db
    .select({ role: chatMessage.role, parts: chatMessage.parts, authorBotId: chatMessage.authorBotId })
    .from(chatMessage)
    .where(and(eq(chatMessage.threadId, params.threadId), gt(chatMessage.seq, Number(mine?.seq ?? 0)), ne(chatMessage.id, params.userMessageId)))
    .orderBy(desc(chatMessage.seq))
    .limit(MAX_LINES);
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name ?? "A bot that left";
  // Never "Name: text" lines: providers read those as chat-role delimiters (prompt injection) and refuse the call.
  const lines = rows
    .reverse()
    .map((r) => [r.role === "user" ? "the user" : nameOf(r.authorBotId), textOf(r)] as const)
    .filter(([, text]) => text)
    .map(([who, text]) => `- From ${who}, quoted: «${text.replace(/[«»]/g, '"')}»`);
  const roster = members.map((m) => `- ${m.name} (@bot:${mentionKey(m.name)}, ${m.role}${m.id === lead?.id ? ", lead" : ""})`).join("\n");
  const next = (params.queue ?? []).map((t) => members.find((m) => m.id === t.botId)?.name).filter(Boolean);
  const after = next.length ? `After you, these members answer the same message on their own: ${next.join(", ")}. Do only your part; do not message them about it.` : "";
  const task = params.chained ? params.content : `The user wrote, quoted: «${params.content}»`;
  const content = [
    `[Group chat "${group.name}"] You are ${me?.name ?? "a member"}. Members:\n${roster}`,
    "Other members only see what is posted here. Use message_bot only to give a member NEW work the user did not already give them (never to pass on, repeat or check work already done or already asked of them). Do not repeat what another member already did.",
    after,
    `Group notes (update_group_memory):\n${group.memory.trim() || "(none)"}`,
    lines.length ? `[Since your last turn]\n${lines.join("\n")}` : "",
    `[Now]\n${task}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { group, members, content };
}

export type GroupTurnContext = NonNullable<Awaited<ReturnType<typeof groupTurn>>>;
export type { GroupMember };
