// eve docs, memory/index + memory/file: one memory document per signed-in user
// (byPrincipal), stored in Neon through the documented custom backend contract.
import { defineMemory } from "eve/memory";
import {
	fileMemory,
	type MemoryDocumentBackend,
	MemoryDocumentConflictError,
} from "eve/memory/file";
import { byPrincipal } from "eve/memory/scope";
import { sql } from "../lib/db";

type Row = { content: string; version: number };

const neonBackend: MemoryDocumentBackend = {
	async read({ key, signal }) {
		signal.throwIfAborted();
		const [row] = (await sql()`
			select content, version from agent_memory where key = ${key}`) as Row[];
		return row ? { content: row.content, version: String(row.version) } : null;
	},
	async write({ key, content, expectedVersion, signal }) {
		signal.throwIfAborted();
		// Compare-and-set: null = must not exist yet; else the version must match.
		const rows = (
			expectedVersion === null
				? await sql()`
					insert into agent_memory (key, content, version) values (${key}, ${content}, 1)
					on conflict (key) do nothing
					returning content, version`
				: await sql()`
					update agent_memory set content = ${content}, version = version + 1, updated_at = now()
					where key = ${key} and version = ${Number(expectedVersion)}
					returning content, version`
		) as Row[];
		if (!rows[0]) throw new MemoryDocumentConflictError(key);
		return { content: rows[0].content, version: String(rows[0].version) };
	},
};

export default defineMemory({
	description: "Remember stable facts and preferences about the user.",
	provider: fileMemory({ backend: neonBackend }),
	scope: byPrincipal,
});
