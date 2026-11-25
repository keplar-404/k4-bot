// Text → video through OpenRouter's async video API (docs: guides/overview/multimodal/
// video-generation): submit, poll until completed, download. A workflow tool, so the
// waits between polls hold no compute (eve docs: tools/workflows). The video is saved
// on the agent's computer in ~/Media, like the media tool's results; share_file gives
// it to the user. Paid: Ask mode confirms each call (agent.ts), 3 per user per day.
import { pickMediaModel } from "@repo/shared/models";
import {
	defineDynamic,
	defineWorkflowTool,
	type WorkflowStepToolContext,
} from "eve/tools";
import { sleep } from "eve/workflow";
import { z } from "zod";
import { appUserId } from "../lib/db";
import { toComputer } from "../lib/files";
import { openrouter, overQuota } from "../lib/media";
import { notInPlan } from "../lib/mode";

const POLLS = 80; // × 15 s = 20 minutes

const inputSchema = z.object({
	prompt: z.string().min(1).max(4000),
	seconds: z.number().int().min(2).max(15).default(5),
	resolution: z.enum(["480p", "720p", "1080p"]).default("480p"),
	aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
	model: z.string().max(200).optional().describe("Omit for the default"),
});
type Input = z.infer<typeof inputSchema>;
type Failed = { error: string };

const tool = defineWorkflowTool({
	description:
		"Make a short video from a text prompt (paid; takes a few minutes). Saved on your computer in ~/Media; call share_file to give it to the user. Describe the scene, camera and mood in `prompt`. Defaults: 5 s, 480p, 16:9; use higher resolution only when the user asks.",
	inputSchema,
	async execute(input, ctx) {
		"use workflow";
		const job = await submit(ctx, input);
		if ("error" in job) return job;
		for (let i = 0; i < POLLS; i++) {
			await sleep("15s");
			const state = await poll(job.id);
			if (state.status === "completed") return await save(ctx, job.id);
			if (state.status === "failed")
				return { error: `The video failed: ${state.error ?? "unknown error"}` };
		}
		return { error: "The video took over 20 minutes, so I stopped waiting." };
	},
});

// Returns errors instead of throwing: a thrown step retries, and a retried submit
// would pay for a second video.
async function submit(
	ctx: WorkflowStepToolContext,
	input: Input,
): Promise<{ id: string } | Failed> {
	"use step";
	const userId = appUserId(ctx.session.auth.current);
	if (!userId) return { error: "Sign in to make videos." };
	if (await overQuota(userId, "video", 1))
		return {
			error: "You reached today's limit of 3 videos. Try again tomorrow.",
		};
	try {
		const res = await openrouter("videos", {
			model: pickMediaModel("video", input.model).id,
			prompt: input.prompt,
			duration: input.seconds,
			resolution: input.resolution,
			aspect_ratio: input.aspectRatio,
		});
		if (!res.ok)
			return {
				error: `Video request failed (${res.status}): ${await res.text()}`,
			};
		const { id } = (await res.json()) as { id?: string };
		return id ? { id } : { error: "The video service returned no job id." };
	} catch (error) {
		return { error: `Video request failed: ${String(error)}` };
	}
}

// Read-only, so a retry is safe.
async function poll(id: string) {
	"use step";
	const res = await openrouter(`videos/${encodeURIComponent(id)}`);
	if (!res.ok) throw new Error(`Video status check failed (${res.status})`);
	return (await res.json()) as { status: string; error?: string };
}

async function save(ctx: WorkflowStepToolContext, id: string) {
	"use step";
	const res = await openrouter(
		`videos/${encodeURIComponent(id)}/content?index=0`,
		undefined,
		300_000,
	);
	if (!res.ok)
		return { error: `Downloading the video failed (${res.status}).` };
	const type =
		res.headers.get("content-type")?.split(";")[0].trim() || "video/mp4";
	const bytes = new Uint8Array(await res.arrayBuffer());
	return toComputer(ctx, "video.mp4", type, bytes);
}

export default defineDynamic(notInPlan(tool));
