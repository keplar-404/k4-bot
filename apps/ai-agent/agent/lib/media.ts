// Shared by the media tools: OpenRouter calls with a timeout and retries, and the
// per-user daily quotas (counted before each call, PLAN.md rule 3).
import { DAY_MS, overLimit } from "@repo/shared/rate-limit";
import { db } from "./db";

/** POST to OpenRouter (GET without a body); 429 and 5xx are retried up to 3 tries with backoff. */
export async function openrouter(
	path: string,
	body?: unknown,
	timeoutMs = 60_000,
) {
	for (let attempt = 1; ; attempt++) {
		const res = await fetch(`https://openrouter.ai/api/v1/${path}`, {
			method: body === undefined ? "GET" : "POST",
			headers: {
				authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
				"content-type": "application/json",
			},
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (res.ok || attempt === 3 || (res.status !== 429 && res.status < 500))
			return res;
		await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
	}
}

// Per user per day: images, videos and music by count, speech and transcription by
// seconds (PLAN.md Phase D rule 3).
const QUOTA = {
	image: 20,
	video: 3,
	music: 10,
	speech: 30 * 60,
	transcribe: 60 * 60,
};

/** Counts `amount` now; true when that puts the user over today's quota. */
export const overQuota = (
	userId: string,
	kind: keyof typeof QUOTA,
	amount: number,
) => overLimit(db(), `media:${kind}:${userId}`, QUOTA[kind], DAY_MS, amount);
