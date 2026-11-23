// POST /api/transcribe: the prompt bar's mic. The browser records (MediaRecorder) and
// sends the audio; OpenRouter turns it into text (docs: multimodal/stt). Whisper
// detects the language itself, 99+ languages. The audio is not stored.
// Paid per second, so four limits stack:
//   1 MB body (a few minutes of speech) · 1 call per 2 s per user ·
//   30 min of audio per user per day (Neon, shared by every instance) ·
//   60 calls a minute across all users, so many accounts can't multiply the cost.
import { DAY_MS, overLimit, overLimitInMemory } from "@repo/shared/rate-limit";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { type Env, requireUser } from "./auth";
import { db } from "./db";

const MODEL = "openai/whisper-large-v3-turbo";
export const MAX_AUDIO_BYTES = 1024 * 1024;
const FORMATS: Record<string, string> = {
	"audio/webm": "webm",
	"audio/ogg": "ogg",
	"audio/mp4": "mp4",
};

export const transcribe = new Hono<Env>().use(requireUser).post(
	"/",
	bodyLimit({
		maxSize: MAX_AUDIO_BYTES,
		onError: (c) => c.json({ error: "The recording is too long." }, 413),
	}),
	async (c) => {
		const userId = c.get("user").id;
		if (
			overLimitInMemory(`stt:${userId}`, 1, 2000) ||
			overLimitInMemory("stt:all", 60, 60_000)
		)
			return c.json({ error: "Too many requests. Try again shortly." }, 429);
		const format = FORMATS[c.req.header("content-type")?.split(";")[0] ?? ""];
		if (!format) return c.json({ error: "Unsupported audio." }, 415);
		const audio = await c.req.arrayBuffer();
		if (audio.byteLength === 0) return c.json({ text: "" }, 200);
		// shortcut: length estimated at 4 KB a second (opus); decode it if quotas must be exact.
		const seconds = Math.ceil(audio.byteLength / 4000);
		if (await overLimit(db, `stt-day:${userId}`, 30 * 60, DAY_MS, seconds))
			return c.json({ error: "Today's voice limit is used up." }, 429);
		const res = await fetch(
			"https://openrouter.ai/api/v1/audio/transcriptions",
			{
				method: "POST",
				headers: {
					authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					model: MODEL,
					input_audio: { data: Buffer.from(audio).toString("base64"), format },
				}),
				signal: AbortSignal.timeout(60_000),
			},
		);
		if (!res.ok) {
			console.error("transcribe failed", res.status, await res.text());
			return c.json({ error: "Transcription failed." }, 502);
		}
		const { text } = (await res.json()) as { text?: string };
		return c.json({ text: text?.trim() ?? "" }, 200);
	},
);
