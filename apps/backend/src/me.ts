import { zValidator } from "@hono/zod-validator";
import {
	MAX_MEMORY_CHARS,
	readMemory,
	replaceMemory,
} from "@repo/shared/memory";
import { Hono } from "hono";
import { z } from "zod";
import { type Env, requireUser } from "./auth";
import { db } from "./db";
import { ensureUserDesktop } from "./desktop";

export const me = new Hono<Env>()
	.use(requireUser)
	// The web app calls this on every dashboard load. It makes sure the user has
	// their one desktop (created here and nowhere else) and is safe to repeat.
	.post("/desktop", async (c) => {
		await ensureUserDesktop(c.get("user").id);
		return c.json({ ok: true }, 200);
	})
	// What the agent remembers about this user (Settings > Memory). `max` is the
	// limit, so the web app doesn't keep its own copy.
	.get("/memory", async (c) => {
		const content = await readMemory(db, c.get("user").id);
		return c.json({ content, max: MAX_MEMORY_CHARS }, 200);
	})
	// The user's edit replaces the whole note; the agent recalls it next turn.
	.put(
		"/memory",
		zValidator("json", z.object({ content: z.string().max(MAX_MEMORY_CHARS) })),
		async (c) => {
			const { content } = c.req.valid("json");
			return c.json(
				{ content: await replaceMemory(db, c.get("user").id, content) },
				200,
			);
		},
	);
