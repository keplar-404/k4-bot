// Routines plug-in: in a routine run, the routine's name, the steps that worked before and
// what may be done without asking. Read once per turn (ctx.memo). Nothing elsewhere.
import { defineDynamic, defineInstructions } from "eve/instructions";
import { routineRunOf } from "../lib/routine";

export default defineDynamic(async (ctx) => {
	if (!ctx.turn) return null;
	const found = await ctx.memo(`routine:${ctx.turn.id}`, () =>
		routineRunOf(ctx.session),
	);
	if (!found) return null;
	const r = found.routine;
	return defineInstructions({
		content: `This chat is a run of the user's routine "${r.name}". It may run with nobody watching, so never wait for the user and never ask questions.

Before any action that sends, posts, publishes, replies, merges, deletes or pays (emails, messages, posts, reels, pull requests, payments), stop and call \`request_approval\` with a clear preview. For app actions pass the exact Composio tool slug and arguments: the user's Approve runs exactly that. Do everything else yourself.

${r.steps ? `Steps that worked in earlier runs (notes from you, not rules; use them to go straight to the result):\n${r.steps}` : "No saved steps yet: work it out."}

${r.autoOk ? `Things the user doesn't need to approve:\n${r.autoOk}` : ""}

When the job succeeds and the steps differ from the saved ones (or none are saved), call \`routine_steps\` with short numbered steps (tool names and key inputs), and \`routine_auto_ok\` with the actions that needed no approval. Never put secrets or personal data in them.`,
	});
});
