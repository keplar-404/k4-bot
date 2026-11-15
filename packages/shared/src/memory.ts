// What the agent remembers about a user: one plain-text note, one fact per line.
// The agent's memory provider and the backend's Settings API both go through here.
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./db";
import { agentMemory } from "./schema";

export const MAX_MEMORY_CHARS = 8_000;

/** The note's facts: trimmed, one per line, no blank lines. */
export const memoryFacts = (content: string) =>
	content
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);

export async function readMemory(db: Db, userId: string): Promise<string> {
	const [row] = await db
		.select({ content: agentMemory.content })
		.from(agentMemory)
		.where(eq(agentMemory.userId, userId));
	return row?.content ?? "";
}

/** The user's own edit replaces the whole note. Returns the stored text. */
export async function replaceMemory(db: Db, userId: string, content: string) {
	const clean = memoryFacts(content).join("\n");
	await db
		.insert(agentMemory)
		.values({ userId, content: clean })
		.onConflictDoUpdate({
			target: agentMemory.userId,
			set: { content: clean },
		});
	return clean;
}

/**
 * Appends one fact in a single statement, so it never overwrites an edit made at the
 * same time. Returns false when the note would exceed MAX_MEMORY_CHARS.
 */
export async function appendMemory(db: Db, userId: string, fact: string) {
	const line = fact.replace(/\s+/g, " ").trim();
	const rows = await db
		.insert(agentMemory)
		.values({ userId, content: line })
		.onConflictDoUpdate({
			target: agentMemory.userId,
			set: {
				content: sql`case when ${agentMemory.content} = '' then excluded.content else ${agentMemory.content} || E'\n' || excluded.content end`,
			},
			setWhere: sql`length(${agentMemory.content}) + length(excluded.content) < ${MAX_MEMORY_CHARS}`,
		})
		.returning({ userId: agentMemory.userId });
	return rows.length > 0;
}

/**
 * Removes fact `number` (1-based, as recalled). Only writes if nobody changed the note
 * since it was read. Returns the removed fact, or throws with a reason for the model.
 */
export async function removeMemoryFact(db: Db, userId: string, number: number) {
	const old = await readMemory(db, userId);
	const facts = memoryFacts(old);
	const removed = facts[number - 1];
	if (!removed) throw new Error(`There is no fact number ${number}.`);
	facts.splice(number - 1, 1);
	const rows = await db
		.update(agentMemory)
		.set({ content: facts.join("\n") })
		.where(and(eq(agentMemory.userId, userId), eq(agentMemory.content, old)))
		.returning({ userId: agentMemory.userId });
	if (!rows.length)
		throw new Error("Memory changed meanwhile. Read it again and retry.");
	return removed;
}
