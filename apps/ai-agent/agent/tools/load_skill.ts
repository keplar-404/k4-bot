// Loads one of the user's skills: its SKILL.md (the instructions) and the list of its
// other files, which read_skill_file and search_skill read on demand. Nothing is
// copied to the computer.
import { SKILL_NAME } from "@repo/shared/skills";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { lines, mySkill, readText } from "../lib/skills";

export default defineTool({
	description:
		"Load one of the user's saved skills by its exact name, when a task matches it or the user names it. Returns its instructions (SKILL.md) and a list of its other files; read those with read_skill_file or search_skill only when the instructions point to them.",
	inputSchema: z.object({ name: z.string().regex(SKILL_NAME) }),
	label: { start: ({ name }) => `Load the ${name} skill` },
	async execute({ name }, ctx) {
		const found = await mySkill(ctx, name);
		if ("error" in found) return found;
		const { skill } = found;
		return {
			name,
			instructions: lines(await readText(skill.prefix, "SKILL.md")),
			files: skill.files.filter((f) => f.path !== "SKILL.md"),
		};
	},
});
