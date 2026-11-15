import { type AppUser, userFromBearer } from "@repo/shared/auth";
import { createMiddleware } from "hono/factory";
import { overLimit } from "./rate-limit";

export const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
export const isDev = process.env.NODE_ENV !== "production";

export type Env = { Variables: { user: AppUser } };

// Sign-in itself is Neon Auth's job (Managed Better Auth). The browser sends the
// signed-in user's token as `Authorization: Bearer ...`; we only check it.
export const requireUser = createMiddleware<Env>(async (c, next) => {
	const user = await userFromBearer(c.req.header("authorization"));
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	// Each user has their own counter, so one heavy user never blocks another.
	if (await overLimit(`api:${user.id}`, 120, 60_000)) {
		return c.json({ error: "Too many requests" }, 429);
	}
	c.set("user", user);
	await next();
});
