import { consoleLoggingIntegration, sentry } from "@sentry/hono/bun";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { isDev, webUrl } from "./auth";
import { chats } from "./chats";
import { me } from "./me";

const isLocal = (o: string) =>
	/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);

// Sentry first (docs: add the middleware as early as possible): errors from onError
// (not 3xx/4xx), request and fetch spans, console.warn/error as Sentry Logs.
// No SENTRY_DSN (tests, a fresh checkout): Sentry stays off.
const base = new Hono();
if (process.env.SENTRY_DSN) {
	base.use(
		sentry(base, {
			dsn: process.env.SENTRY_DSN,
			environment: isDev ? "development" : "production",
			// ponytail: 20% in production fits the free plan's span quota; raise with budget.
			tracesSampleRate: isDev ? 1 : 0.2,
			integrations: [consoleLoggingIntegration({ levels: ["warn", "error"] })],
		}),
	);
}

// Chained so the RPC client gets one inferred AppType (hono.dev/docs/guides/rpc).
// Order follows the hono-middleware skill: id, log, security headers, CORS, routes.
const app = base
	.use(requestId())
	.use(logger())
	.use(secureHeaders())
	// The largest real body is an 8,000-character memory note; refuse anything far bigger.
	.use(bodyLimit({ maxSize: 64 * 1024 }))
	// dev: any localhost origin; prod: only WEB_URL (WEB_URL)
	.use(
		"*",
		cors({
			origin: (o) => (o === webUrl || (isDev && isLocal(o)) ? o : null),
		}),
	)
	.route("/api/chats", chats)
	.route("/api/me", me)
	.get("/", (c) => c.text("ok"))
	// Always JSON, never a stack trace; the request id in the log matches X-Request-Id.
	.notFound((c) => c.json({ error: "Not found" }, 404))
	.onError((err, c) => {
		if (err instanceof HTTPException) return err.getResponse();
		console.error(c.get("requestId"), err);
		return c.json({ error: "Internal Server Error" }, 500);
	});

export type AppType = typeof app;

export default { port: Number(process.env.PORT ?? 8787), fetch: app.fetch };
