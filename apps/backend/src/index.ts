import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";

const app = new Hono();

const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
const isLocal = (o: string) =>
	/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);

// dev: any localhost origin; prod: only WEB_URL
app.use(
	"*",
	cors({
		origin: (o) =>
			o === webUrl || (process.env.NODE_ENV !== "production" && isLocal(o))
				? o
				: null,
		credentials: true,
	}),
);

app.all("/api/auth/*", (c) => auth.handler(c.req.raw));

app.get("/", (c) => c.text("ok"));

export default app;
