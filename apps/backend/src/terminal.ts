// A root shell on the user's own computer (right panel > Terminal): xterm.js in the
// browser ⇄ this WebSocket ⇄ an E2B PTY (docs: sandbox/pty). Browsers can't set
// headers on a WebSocket, so the first message carries the token (never the URL, so
// it stays out of logs); nothing reaches the computer before it checks out.
import { userFromBearer } from "@repo/shared/auth";
import { IDLE_MS, userDesktop } from "@repo/shared/computer";
import { overLimit } from "@repo/shared/rate-limit";
import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import { z } from "zod";
import { allowedOrigin } from "./auth";
import { db } from "./db";

const Hello = z.object({
	token: z.string().min(1).max(8192),
	cols: z.number().int().min(10).max(500),
	rows: z.number().int().min(5).max(200),
});

// The longest one shell lives; the user opens a new one after.
const MAX_MS = 60 * 60_000;

async function open(hello: string, ws: WSContext) {
	let parsed: z.infer<typeof Hello>;
	try {
		parsed = Hello.parse(JSON.parse(hello));
	} catch {
		return null;
	}
	const user = await userFromBearer(`Bearer ${parsed.token}`);
	if (!user || (await overLimit(db, `terminal:${user.id}`, 10, 60_000)))
		return null;
	const { sbx } = await userDesktop(db, user.id);
	const pty = await sbx.pty.create({
		cols: parsed.cols,
		rows: parsed.rows,
		user: "root",
		cwd: "/root",
		timeoutMs: MAX_MS,
		onData: (d) => ws.send(new Uint8Array(d)),
	});
	// kill() is SIGKILL, so wait() rejects on every close; an uncaught rejection crashes Bun.
	pty
		.wait()
		.catch(() => {})
		.finally(() => ws.close());
	// Typing keeps the computer on: E2B's pause timer restarts at most once a minute.
	let awake = Date.now();
	return {
		send: (d: Uint8Array) => {
			if (Date.now() - awake > 60_000) {
				awake = Date.now();
				sbx.setTimeout(IDLE_MS).catch(() => {});
			}
			return sbx.pty.sendInput(pty.pid, d);
		},
		kill: () => sbx.pty.kill(pty.pid).catch(() => false),
	};
}

export const terminal = new Hono().get(
	"/",
	// Cross-site WebSocket hijacking: only our own web app may open one.
	async (c, next) => {
		if (!allowedOrigin(c.req.header("origin") ?? ""))
			return c.json({ error: "Forbidden" }, 403);
		await next();
	},
	upgradeWebSocket(() => {
		let pty: ReturnType<typeof open> | undefined;
		const bytes = new TextEncoder();
		return {
			onMessage(e, ws) {
				const text =
					typeof e.data === "string"
						? e.data
						: new TextDecoder().decode(e.data as ArrayBuffer);
				if (!pty) {
					pty = open(text, ws).catch(() => null);
					pty.then((p) => p ?? ws.close(1008, "Unauthorized"));
					return;
				}
				pty.then((p) => p?.send(bytes.encode(text))).catch(() => {});
			},
			onClose() {
				pty?.then((p) => p?.kill());
			},
		};
	}),
);
