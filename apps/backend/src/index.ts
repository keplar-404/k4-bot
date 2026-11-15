import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth, isDev, webUrl } from "./auth";
import { chats } from "./chats";

const isLocal = (o: string) =>
	/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);

// Chained so the RPC client gets one inferred AppType (hono.dev/docs/guides/rpc).
const app = new Hono()
	// dev: any localhost origin; prod: only WEB_URL (same rule as auth.ts)
	.use(
		"*",
		cors({
			origin: (o) => (o === webUrl || (isDev && isLocal(o)) ? o : null),
			credentials: true,
		}),
	)
	.all("/api/auth/*", (c) => auth.handler(c.req.raw))
	.route("/api/chats", chats)
	.get("/", (c) => c.text("ok"));

export type AppType = typeof app;

export default {
	port: Number(process.env.PORT ?? 8787),
	// Better Auth rate-limit docs, "Clients connect directly": set the client IP
	// in a header from server code. Overwritten every time, so clients can't spoof it.
	// Behind a proxy this is the proxy's IP: then use the proxy's header instead.
	fetch: (
		req: Request,
		server: { requestIP(r: Request): { address: string } | null },
	) => {
		const headers = new Headers(req.headers);
		headers.set("x-client-ip", server.requestIP(req)?.address ?? "");
		return app.fetch(new Request(req, { headers }));
	},
};
