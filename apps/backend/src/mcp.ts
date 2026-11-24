// The user's own MCP servers (Settings > Connectors). The API key is write-only:
//   GET    /api/me/mcp        -> name, host, logo, whether a key is saved (never the key)
//   POST   /api/me/mcp        -> add one; checked and test-called before it's saved
//   DELETE /api/me/mcp/:name  -> removes it and its key
// No update: to change a key or URL, delete and add again.
import { zValidator } from "@hono/zod-validator";
import {
	checkMcpUrl,
	keyHeader,
	MAX_MCP_PER_USER,
	MCP_NAME,
	probeMcp,
	sealKey,
} from "@repo/shared/mcp";
import { overLimit } from "@repo/shared/rate-limit";
import { userMcp } from "@repo/shared/schema";
import { and, count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { type Env, requireUser } from "./auth";
import { db } from "./db";

const mine = (userId: string, name: string) =>
	and(eq(userMcp.userId, userId), eq(userMcp.name, name));

export const mcp = new Hono<Env>()
	.use(requireUser)
	.get("/", async (c) => {
		const rows = await db
			.select({
				name: userMcp.name,
				url: userMcp.url,
				logo: userMcp.logo,
				header: userMcp.header,
			})
			.from(userMcp)
			.where(eq(userMcp.userId, c.get("user").id))
			.orderBy(desc(userMcp.createdAt));
		return c.json(
			{
				servers: rows.map((r) => ({
					name: r.name,
					host: new URL(r.url).host,
					logo: r.logo,
					hasKey: !!r.header,
				})),
			},
			200,
		);
	})
	.post(
		"/",
		zValidator(
			"json",
			z.object({
				name: z.string().regex(MCP_NAME),
				url: z.string().max(500),
				// A header name (RFC 7230 token); the key goes in it.
				header: z
					.string()
					.regex(/^[A-Za-z0-9-]{1,64}$/)
					.optional(),
				key: z.string().min(1).max(4000).optional(),
			}),
		),
		async (c) => {
			const userId = c.get("user").id;
			const { name, url, key } = c.req.valid("json");
			const header = key
				? (c.req.valid("json").header ?? "Authorization")
				: null;
			if (await overLimit(db, `mcp-add:${userId}`, 10, 60 * 60_000))
				return c.json({ error: "Too many tries. Try again later." }, 429);
			const [[taken], [{ n }]] = await Promise.all([
				db
					.select({ name: userMcp.name })
					.from(userMcp)
					.where(mine(userId, name)),
				db
					.select({ n: count() })
					.from(userMcp)
					.where(eq(userMcp.userId, userId)),
			]);
			if (taken)
				return c.json(
					{ error: `“${name}” is taken. Delete it first to replace it.` },
					409,
				);
			if (n >= MAX_MCP_PER_USER)
				return c.json(
					{ error: `You can add at most ${MAX_MCP_PER_USER} servers.` },
					409,
				);
			const bad = await checkMcpUrl(url);
			if (bad) return c.json({ error: bad }, 400);
			const probe = await probeMcp(
				url,
				header && key ? keyHeader(header, key) : {},
			);
			if ("error" in probe) return c.json({ error: probe.error }, 400);
			const description = [
				`${probe.title ?? name} (the user's own MCP server, @${name}).`,
				probe.instructions,
			]
				.filter(Boolean)
				.join(" ");
			await db.insert(userMcp).values({
				userId,
				name,
				url,
				description,
				logo: probe.logo,
				header,
				key: header && key ? sealKey(key, userId, name) : null,
			});
			return c.json(
				{ name, host: new URL(url).host, logo: probe.logo, hasKey: !!header },
				200,
			);
		},
	)
	.delete(
		"/:name",
		zValidator("param", z.object({ name: z.string().regex(MCP_NAME) })),
		async (c) => {
			const [row] = await db
				.delete(userMcp)
				.where(mine(c.get("user").id, c.req.valid("param").name))
				.returning({ name: userMcp.name });
			if (!row) return c.json({ error: "Not found" }, 404);
			return c.json({ ok: true }, 200);
		},
	);
