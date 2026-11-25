import { type AppUser, userFromBearer } from "@repo/shared/auth";
import { overLimit, overLimitInMemory } from "@repo/shared/rate-limit";
import { createMiddleware } from "hono/factory";
import { db } from "./db";

export const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
export const isDev = process.env.NODE_ENV !== "production";
// dev: any localhost origin; prod: only WEB_URL. Used by CORS and the terminal socket.
export const allowedOrigin = (o: string) =>
	o === webUrl ||
	(isDev && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o));

export type Env = { Variables: { user: AppUser } };

// Sign-in itself is Neon Auth's job (Managed Better Auth). The browser sends the
// signed-in user's token as `Authorization: Bearer ...`; we only check it.
export const requireUser = createMiddleware<Env>(async (c, next) => {
	const user = await userFromBearer(c.req.header("authorization"));
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	// Each user has their own counter, so one heavy user never blocks another. Reads
	// count in memory (no Neon write per request); writes use the shared Neon counter.
	const read = c.req.method === "GET" || c.req.method === "HEAD";
	const limited = read
		? overLimitInMemory(`api:${user.id}`, 240, 60_000)
		: await overLimit(db, `api-write:${user.id}`, 60, 60_000);
	if (limited) {
		return c.json({ error: "Too many requests" }, 429);
	}
	c.set("user", user);
	await next();
});
