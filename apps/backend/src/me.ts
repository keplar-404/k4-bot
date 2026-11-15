import { Hono } from "hono";
import { type Env, requireUser } from "./auth";
import { ensureUserDesktop } from "./desktop";

// The web app calls this once after sign-in. It makes sure the user has their one
// desktop (created here and nowhere else) and is safe to repeat.
export const me = new Hono<Env>()
	.use(requireUser)
	.post("/desktop", async (c) => {
		await ensureUserDesktop(c.get("user").id);
		return c.json({ ok: true }, 200);
	});
