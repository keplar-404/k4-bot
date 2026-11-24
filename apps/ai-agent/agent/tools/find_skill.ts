// Searches the skills the user uploaded (Settings > Skills). Only names and
// descriptions; load_skill reads one. Always the signed-in user's own skills.
import { findSkills } from "@repo/shared/skills";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { appUserId, db } from "../lib/db";

export default defineTool({
	description:
		"Search the skills the user saved (their own procedures for tasks) by words in their name or description. Returns up to 10 names with descriptions; then call load_skill.",
	inputSchema: z.object({ query: z.string().min(1).max(200) }),
	label: { start: ({ query }) => `Look for a skill: “${query}”` },
	async execute({ query }, ctx) {
		const userId = appUserId(ctx.session.auth.current);
		if (!userId) return { error: "Sign in to use skills." };
		const skills = await findSkills(db(), userId, query);
		return skills.length ? { skills } : { skills, note: "No skill matches." };
	},
});
