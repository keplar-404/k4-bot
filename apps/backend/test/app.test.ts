import { expect, test } from "bun:test";

// Importing the app needs these; nothing here connects to a database.
process.env.DATABASE_URL ??= "postgres://u:p@localhost/db";
const { default: server } = await import("../src/index");
const call = (path: string, init?: RequestInit) =>
	server.fetch(new Request(`http://api.test${path}`, init));

test("unknown paths and signed-out chat calls answer in JSON", async () => {
	const missing = await call("/nope");
	expect(missing.status).toBe(404);
	expect(await missing.json()).toEqual({ error: "Not found" });
	const chats = await call("/api/chats");
	expect(chats.status).toBe(401);
	expect(await chats.json()).toEqual({ error: "Unauthorized" });
});

test("memory is only for the signed-in user", async () => {
	expect((await call("/api/me/memory")).status).toBe(401);
	const put = await call("/api/me/memory", {
		method: "PUT",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ content: "x" }),
	});
	expect(put.status).toBe(401);
});

test("every response has a request id and security headers", async () => {
	const res = await call("/");
	expect(res.headers.get("x-request-id")).toBeTruthy();
	expect(res.headers.get("x-content-type-options")).toBe("nosniff");
});

test("CORS only answers the web app's origin", async () => {
	const ask = (origin: string) =>
		call("/api/chats", {
			method: "OPTIONS",
			headers: { origin, "access-control-request-method": "GET" },
		});
	expect(
		(await ask("http://localhost:3000")).headers.get(
			"access-control-allow-origin",
		),
	).toBe("http://localhost:3000");
	expect(
		(await ask("https://evil.example")).headers.get(
			"access-control-allow-origin",
		),
	).toBeNull();
});
