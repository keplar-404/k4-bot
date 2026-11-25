// What the agent remembers about a user: one plain-text note, one fact per line.
// The agent's memory provider and the backend's Settings API both go through here.
import { eq } from "drizzle-orm";
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
