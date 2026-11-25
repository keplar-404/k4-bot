import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { websocket } from "hono/bun";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { allowedOrigin } from "./auth";
import { chats } from "./chats";
import { myComputer } from "./computer";
import { files } from "./files";
import { mcp } from "./mcp";
import { me } from "./me";
import { skills } from "./skills";
import { terminal } from "./terminal";
import { transcribe } from "./transcribe";

// Chained so the RPC client gets one inferred AppType (hono.dev/docs/guides/rpc).
// Order follows the hono-middleware skill: id, log, security headers, CORS, routes.
const small = bodyLimit({ maxSize: 64 * 1024 });
// A skill upload: 10 MB of files (skills.ts checks the real limits) plus form overhead.
const skillUpload = bodyLimit({ maxSize: 11 * 1024 * 1024 });

const app = new Hono()
	.use(requestId())
	.use(logger())
	.use(secureHeaders())
	// gzip for JSON and text over 1 KB (chat history is the big one). Hono skips
	// event streams, images, websocket upgrades and anything already encoded.
	.use(compress())
	// zValidator's default 400 sends zod's whole error, regexes and limits included.
	// Send which fields were wrong, nothing more.
	.use(async (c, next) => {
		await next();
		if (c.res.status !== 400) return;
		const body = await c.res
			.clone()
			.json()
			.catch(() => null);
		if (body?.success !== false || body.error?.name !== "ZodError") return;
		// zod 4 serializes its issues as a JSON string in `message`.
		let issues: { path?: unknown[] }[] = [];
		try {
			issues = JSON.parse(body.error.message);
		} catch {}
		const fields = [
			...new Set(issues.map((i) => (i.path ?? []).join(".")).filter(Boolean)),
		];
		c.res = c.json({ error: "Invalid request.", fields }, 400);
	})
	// The largest real body is an 8,000-character memory note; refuse anything far bigger.
	// Audio for the mic has its own 1 MB limit (transcribe.ts).
	.use((c, next) =>
		c.req.path === "/api/transcribe"
			? next()
			: c.req.path === "/api/me/skills" && c.req.method === "POST"
				? skillUpload(c, next)
				: small(c, next),
	)
	.use(
		"*",
		cors({
			origin: (o) => (allowedOrigin(o) ? o : null),
			// The browser reuses one preflight for 2h (Chrome's cap) instead of one per call.
			maxAge: 7200,
		}),
	)
	.route("/api/chats", chats)
	.route("/api/me/computer", myComputer)
	.route("/api/files", files)
	.route("/api/me/skills", skills)
	.route("/api/me/mcp", mcp)
	.route("/api/me", me)
	.route("/api/terminal", terminal)
	.route("/api/transcribe", transcribe)
	.get("/", (c) => c.text("ok"))
	// Always JSON, never a stack trace; the request id in the log matches X-Request-Id.
	.notFound((c) => c.json({ error: "Not found" }, 404))
	.onError((err, c) => {
		if (err instanceof HTTPException) return err.getResponse();
		console.error(c.get("requestId"), err);
		return c.json({ error: "Internal Server Error" }, 500);
	});

export type AppType = typeof app;

export default {
	port: Number(process.env.PORT ?? 8787),
	fetch: app.fetch,
	websocket,
};
