// Chat, memory and rate-limit routes against a real Postgres. Writes rows only for
// random test users and deletes them afterwards. Skipped unless TEST_DATABASE_URL is
// set; point it at a throwaway Neon branch, never production.
import { afterAll, describe, expect, test } from "bun:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const dbUrl = process.env.TEST_DATABASE_URL;

// A local stand-in for Neon Auth's public keys, so real signed tokens pass requireUser.
const { publicKey, privateKey } = await generateKeyPair("EdDSA");
const jwk = { ...(await exportJWK(publicKey)), alg: "EdDSA", kid: "test" };
const keys = Bun.serve({
	port: 0,
	fetch: () => Response.json({ keys: [jwk] }),
});
const issuer = `http://localhost:${keys.port}`;

const users = [crypto.randomUUID(), crypto.randomUUID()];
const tokenFor = (sub: string) =>
	new SignJWT({ email: "t@example.com" })
		.setProtectedHeader({ alg: "EdDSA", kid: "test" })
		.setSubject(sub)
		.setIssuer(issuer)
		.setAudience(issuer)
		.setExpirationTime("5m")
		.sign(privateKey);

describe.skipIf(!dbUrl)("routes (TEST_DATABASE_URL)", async () => {
	process.env.DATABASE_URL = dbUrl;
	process.env.NEON_AUTH_JWKS_URL = `${issuer}/jwks`;
	const { default: server } = await import("../src/index");
	const { db, pool } = await import("../src/db");
	const { overLimit } = await import("@repo/shared/rate-limit");
	const { agentMemory, chat, rateLimit, userProviderKey } = await import(
		"@repo/shared/schema"
	);
	process.env.PROVIDER_KEY_SECRET ??= Buffer.alloc(32, 1).toString("base64");
	const { inArray, like } = await import("drizzle-orm");

	const as = async (user: string, path: string, init: RequestInit = {}) =>
		server.fetch(
			new Request(`http://api.test${path}`, {
				...init,
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${await tokenFor(user)}`,
				},
			}),
		);

	afterAll(async () => {
		await db.delete(chat).where(inArray(chat.userId, users));
		await db.delete(agentMemory).where(inArray(agentMemory.userId, users));
		await db
			.delete(userProviderKey)
			.where(inArray(userProviderKey.userId, users));
		for (const u of users)
			await db.delete(rateLimit).where(like(rateLimit.key, `%${u}%`));
		await pool.end();
		keys.stop();
	});

	test("a chat can be created, listed, saved, read and deleted", async () => {
		const [me] = users;
		const created = await as(me, "/api/chats", {
			method: "POST",
			body: JSON.stringify({ title: "  Hello  " }),
		});
		expect(created.status).toBe(201);
		const { id } = await created.json();

		const list = await (await as(me, "/api/chats")).json();
		expect(list.chats.map((c: { id: string }) => c.id)).toContain(id);

		const saved = await as(me, `/api/chats/${id}`, {
			method: "PATCH",
			body: JSON.stringify({ eveSessionId: `sess-${id}` }),
		});
		expect(saved.status).toBe(200);
		const got = await (await as(me, `/api/chats/${id}`)).json();
		expect(got.chat).toMatchObject({
			title: "Hello",
			eveSessionId: `sess-${id}`,
		});

		// `after` returns only events past the browser's cached line.
		const { agentEvent } = await import("@repo/shared/schema");
		const ev = (line: number) => ({
			sessionId: `sess-${id}`,
			line,
			index: 0,
			userId: me,
			type: "content.completed",
			scope: {},
			data: { line },
		});
		await db.insert(agentEvent).values([ev(0), ev(1), ev(2)]);
		const lines = async (q: string) =>
			(await (await as(me, `/api/chats/${id}${q}`)).json()).events.map(
				(e: { meta: { position: { line: number } } }) => e.meta.position.line,
			);
		expect(await lines("")).toEqual([0, 1, 2]);
		expect(await lines("?after=1")).toEqual([2]);
		expect(await lines("?after=2")).toEqual([]);
		expect((await as(me, `/api/chats/${id}?after=x`)).status).toBe(400);

		// No eve session is running for this id; delete still removes the chat.
		expect(
			(await as(me, `/api/chats/${id}`, { method: "DELETE" })).status,
		).toBe(200);
		expect((await as(me, `/api/chats/${id}`)).status).toBe(404);
	});

	test("another user's chat is not found, and bad input is refused", async () => {
		const [me, other] = users;
		const { id } = await (
			await as(me, "/api/chats", {
				method: "POST",
				body: JSON.stringify({ title: "mine" }),
			})
		).json();
		expect((await as(other, `/api/chats/${id}`)).status).toBe(404);
		expect(
			(await as(other, `/api/chats/${id}`, { method: "DELETE" })).status,
		).toBe(404);
		expect((await as(me, "/api/chats/not-a-uuid")).status).toBe(404);
		const empty = await as(me, "/api/chats", {
			method: "POST",
			body: JSON.stringify({ title: "   " }),
		});
		expect(empty.status).toBe(400);
	});

	test("a provider key is stored sealed, per user, and never returned", async () => {
		const [me, other] = users;
		const put = (id: string, apiKey: string) =>
			as(me, `/api/me/providers/${id}`, {
				method: "PUT",
				body: JSON.stringify({ values: { apiKey } }),
			});
		expect((await put("openai", "sk-test-abcd1234")).status).toBe(200);
		expect((await put("not-a-provider", "sk-test-abcd1234")).status).toBe(404);
		expect((await put("openai", "has space")).status).toBe(400);
		const [row] = await db
			.select()
			.from(userProviderKey)
			.where(inArray(userProviderKey.userId, [me]));
		expect(row.sealed).not.toContain("sk-test");
		const body = await (await as(me, "/api/me/providers")).text();
		expect(body).not.toContain("sk-test");
		const list = JSON.parse(body);
		expect(
			list.providers.find((p: { id: string }) => p.id === "openai").saved,
		).toEqual({ hint: "…1234", config: {} });
		expect(list.models.length).toBeGreaterThan(0);
		const theirs = await (await as(other, "/api/me/providers")).json();
		expect(theirs.models).toEqual([]);
		expect(
			(await as(other, "/api/me/providers/openai", { method: "DELETE" }))
				.status,
		).toBe(404);
		expect(
			(await as(me, "/api/me/providers/openai", { method: "DELETE" })).status,
		).toBe(200);
	});

	test("memory is saved cleaned, per user, and capped", async () => {
		const [me, other] = users;
		const put = await as(me, "/api/me/memory", {
			method: "PUT",
			body: JSON.stringify({ content: " likes tea \n\n  lives in Oslo " }),
		});
		expect(await put.json()).toEqual({ content: "likes tea\nlives in Oslo" });
		const mine = await (await as(me, "/api/me/memory")).json();
		expect(mine.content).toBe("likes tea\nlives in Oslo");
		expect((await (await as(other, "/api/me/memory")).json()).content).toBe("");
		const big = await as(me, "/api/me/memory", {
			method: "PUT",
			body: JSON.stringify({ content: "x".repeat(mine.max + 1) }),
		});
		expect(big.status).toBe(400);
	});

	test("the rate limit counts per key and refuses over the max", async () => {
		const key = `test:${users[0]}`;
		expect(await overLimit(db, key, 2, 60_000)).toBe(false);
		expect(await overLimit(db, key, 2, 60_000)).toBe(false);
		expect(await overLimit(db, key, 2, 60_000)).toBe(true);
		expect(await overLimit(db, `test:${users[1]}`, 2, 60_000)).toBe(false);
		// `by` adds an amount (seconds of audio); `by: 0` reads without counting.
		const amount = `by-test:${users[0]}`;
		expect(await overLimit(db, amount, 1000, 60_000, 900)).toBe(false);
		expect(await overLimit(db, amount, 1000, 60_000, 0)).toBe(false);
		expect(await overLimit(db, amount, 1000, 60_000, 200)).toBe(true);
		expect(await overLimit(db, amount, 1000, 60_000, 0)).toBe(true);
	});
});
