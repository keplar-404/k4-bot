// Finds lines in one skill's text files, so the model reads only the part it needs
// (then read_skill_file around a match). Only the signed-in user's own skills.
import { SKILL_NAME } from "@repo/shared/skills";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { isText, mySkill, readText } from "../lib/skills";

const MAX_MATCHES = 40;

export default defineTool({
	description:
		"Search the text and code files of one of the user's skills for a word or phrase (case-insensitive). Returns matching lines with file and line number; read around one with read_skill_file.",
	inputSchema: z.object({
		name: z.string().regex(SKILL_NAME),
		query: z.string().min(1).max(200),
		path: z.string().max(600).optional().describe("Only this file"),
	}),
	label: { start: ({ name, query }) => `Search ${name} for “${query}”` },
	async execute({ name, query, path }, ctx) {
		const found = await mySkill(ctx, name, path);
		if ("error" in found) return found;
		const { skill } = found;
		const files = skill.files.filter(
			(f) => isText(f.type) && (!path || f.path === path),
		);
		const needle = query.toLowerCase();
		const matches: { path: string; line: number; text: string }[] = [];
		for (const f of files) {
			const text = await readText(skill.prefix, f.path);
			text.split("\n").forEach((l, i) => {
				if (matches.length < MAX_MATCHES && l.toLowerCase().includes(needle))
					matches.push({ path: f.path, line: i + 1, text: l.slice(0, 300) });
			});
			if (matches.length >= MAX_MATCHES) break;
		}
		return matches.length ? { matches } : { matches, note: "No line matches." };
	},
});
