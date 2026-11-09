/** `@bot:Name` with the name's spaces written as `-` or `_` (the "@" menu inserts that form). */
const MENTION = /@bot:([\p{L}\p{N}_.-]+)/gu;

export const mentionKey = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Which members a group message addresses, in the order they are mentioned (each once). Unknown names are ignored;
 * a message that names nobody goes to the lead.
 */
export function addressed<T extends { id: string; name: string }>(text: string, members: T[], lead: T): T[] {
  const byKey = new Map(members.map((m) => [mentionKey(m.name), m]));
  const out: T[] = [];
  for (const match of text.matchAll(MENTION)) {
    const m = byKey.get(mentionKey(match[1]!));
    if (m && !out.includes(m)) out.push(m);
  }
  return out.length ? out : [lead];
}

/** A member by the name a bot wrote ("Writer", "@bot:writer", "the-writer"…). */
export function memberNamed<T extends { name: string }>(members: T[], name: string): T | undefined {
  const key = mentionKey(name.replace(/^@(bot:)?/, ""));
  return members.find((m) => mentionKey(m.name) === key);
}
