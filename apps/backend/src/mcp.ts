// The user's own MCP servers (Settings > Custom connectors), hosted by Composio as Custom
// MCP toolkits (@repo/shared/mcp). K4 keeps no keys or tokens: users type keys and sign
// in on Composio's connect page, and Composio makes the calls.
//   GET    /api/me/mcp               -> the user's servers, and whether each is connected
//   POST   /api/me/mcp               -> add one; returns a connect link when it needs a key or sign-in
//   POST   /api/me/mcp/:name/connect -> a new connect link (to connect again)
//   DELETE /api/me/mcp/:name         -> remove it, with this user's connection to it
import { zValidator } from "@hono/zod-validator";
import {
	ComposioError,
	deleteToolkit,
	ensureToolkit,
	MAX_MCP_PER_USER,
	MCP_NAME,
	mcpUrlError,
	slugInUse,
} from "@repo/shared/mcp";
import { overLimit } from "@repo/shared/rate-limit";
import { userMcp } from "@repo/shared/schema";
import { and, count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { type Env, requireUser, webUrl } from "./auth";
import { db } from "./db";
import { composio, connectedSlugs, forget } from "./me";

const mine = (userId: string, name: string) =>
	and(eq(userMcp.userId, userId), eq(userMcp.name, name));

// Composio sends the user back to a dashboard page of this app (like Connected apps).
const returnTo = z.string().regex(/^\/dashboard(\/[\w-]*)*$/);

/** A Composio connect link for this user and toolkit. */
async function connectLink(userId: string, slug: string, back: string) {
	await forget(userId); // read connections again when they're back
	const session = await composio().create(userId, {
		toolkits: [slug],
		sandbox: { enable: false },
	});
	const request = await session.authorize(slug, {
		callbackUrl: `${webUrl}${back}`,
	});
	return request.redirectUrl ?? null;
}

const view = (
	r: { name: string; url: string; auth: string; slug: string },
	on: Set<string>,
) => ({
	name: r.name,
	host: new URL(r.url).host,
	auth: r.auth as "none" | "key" | "oauth",
	connected: r.auth === "none" || on.has(r.slug.toLowerCase()),
});

const nameParam = zValidator(
	"param",
	z.object({ name: z.string().regex(MCP_NAME) }),
);

export const mcp = new Hono<Env>()
	.use(requireUser)
	.get("/", async (c) => {
		const userId = c.get("user").id;
		const rows = await db
			.select()
			.from(userMcp)
			.where(eq(userMcp.userId, userId))
			.orderBy(desc(userMcp.createdAt));
		const on = rows.some((r) => r.auth !== "none")
			? await connectedSlugs(userId).catch(() => new Set<string>())
			: new Set<string>();
		return c.json({ servers: rows.map((r) => view(r, on)) }, 200);
	})
	.post(
		"/",
		zValidator(
			"json",
			z.object({
				name: z.string().regex(MCP_NAME),
				url: z.string().max(500),
				auth: z.enum(["none", "key", "oauth"]),
				// The header the key goes in (an RFC 7230 token), for auth "key".
				header: z
					.string()
					.regex(/^[A-Za-z0-9-]{1,64}$/)
					.optional(),
				returnTo,
			}),
		),
		async (c) => {
			const userId = c.get("user").id;
			const { name, url, auth, header } = c.req.valid("json");
			if (await overLimit(db, `mcp-add:${userId}`, 10, 60 * 60_000))
				return c.json({ error: "Too many tries. Try again later." }, 429);
			// A header name is letters and dashes (Authorization, X-API-Key); a key has
			// digits or is long. Keys are typed on Composio's page, never sent here.
			if (header && !/^[A-Za-z][A-Za-z-]{0,39}$/.test(header))
				return c.json(
					{
						error:
							"That looks like a key. Enter the header name (like Authorization); you'll type the key on Composio's page next.",
					},
					400,
				);
			const bad = mcpUrlError(url);
			if (bad) return c.json({ error: bad }, 400);
			const [[dup], [{ n }]] = await Promise.all([
				db
					.select({ name: userMcp.name })
					.from(userMcp)
					.where(mine(userId, name)),
				db
					.select({ n: count() })
					.from(userMcp)
					.where(eq(userMcp.userId, userId)),
			]);
			if (dup)
				return c.json({ error: `“${name}” is taken. Remove it first.` }, 409);
			if (n >= MAX_MCP_PER_USER)
				return c.json(
					{ error: `You can add at most ${MAX_MCP_PER_USER} servers.` },
					409,
				);
			if (
				(
					await db
						.select({ name: userMcp.name })
						.from(userMcp)
						.where(and(eq(userMcp.userId, userId), eq(userMcp.url, url)))
				).length
			)
				return c.json({ error: "You already added this server." }, 409);
			let toolkit: Awaited<ReturnType<typeof ensureToolkit>>;
			try {
				toolkit = await ensureToolkit({ name, url, auth, header });
			} catch (e) {
				if (e instanceof ComposioError)
					return c.json({ error: e.message }, 400);
				throw e;
			}
			const [row] = await db
				.insert(userMcp)
				.values({ userId, name, url, ...toolkit })
				.onConflictDoNothing()
				.returning();
			if (!row)
				return c.json({ error: `“${name}” is taken. Remove it first.` }, 409);
			const connectUrl =
				toolkit.auth === "none"
					? null
					: await connectLink(
							userId,
							toolkit.slug,
							c.req.valid("json").returnTo,
						);
			return c.json(
				{
					server: view(row, new Set()),
					connectUrl,
					reused: toolkit.auth !== auth,
				},
				200,
			);
		},
	)
	.post(
		"/:name/connect",
		nameParam,
		zValidator("json", z.object({ returnTo })),
		async (c) => {
			const userId = c.get("user").id;
			if (await overLimit(db, `apps-change:${userId}`, 10, 60_000))
				return c.json({ error: "Too many requests" }, 429);
			const [row] = await db
				.select()
				.from(userMcp)
				.where(mine(userId, c.req.valid("param").name));
			if (!row || row.auth === "none")
				return c.json({ error: "Not found" }, 404);
			const url = await connectLink(
				userId,
				row.slug,
				c.req.valid("json").returnTo,
			);
			return c.json({ url }, 200);
		},
	)
	.delete("/:name", nameParam, async (c) => {
		const userId = c.get("user").id;
		const [row] = await db
			.delete(userMcp)
			.where(mine(userId, c.req.valid("param").name))
			.returning();
		if (!row) return c.json({ error: "Not found" }, 404);
		if (await slugInUse(db, row.slug)) {
			// Others still use the toolkit: remove only this user's connections to it,
			// unfinished connect attempts too.
			const { items } = await composio().connectedAccounts.list({
				userIds: [userId],
				toolkitSlugs: [row.slug.toLowerCase()],
			});
			for (const a of items) await composio().connectedAccounts.delete(a.id);
		} else {
			// The last user: delete the toolkit (Composio revokes its connections).
			await deleteToolkit(row.slug).catch(() => {});
		}
		await forget(userId);
		return c.json({ ok: true }, 200);
	});
