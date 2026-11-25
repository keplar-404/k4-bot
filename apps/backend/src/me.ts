import { Composio } from "@composio/core";
import { zValidator } from "@hono/zod-validator";
import { listMcp } from "@repo/shared/mcp";
import {
	MAX_MEMORY_CHARS,
	readMemory,
	replaceMemory,
} from "@repo/shared/memory";
import { overLimit, overLimitInMemory } from "@repo/shared/rate-limit";
import { appCache } from "@repo/shared/schema";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { type Env, requireUser, webUrl } from "./auth";
import { db } from "./db";

// Composio Platform: the Composio user is the Neon Auth user id, as in the agent's
// connection. Docs: configuring-sessions > toolkits() / authorize().
// Created on first use, so the app (and its tests) load without COMPOSIO_API_KEY.
let client: Composio | undefined;
export const composio = () => {
	client ??= new Composio();
	return client;
};
export const appSession = (userId: string) =>
	composio().create(userId, { sandbox: { enable: false } });

// The @ menu's apps, read from app_cache (schema.ts) instead of Composio each time.
type CatalogApp = { slug: string; name: string; logo?: string };
const DAY = 86_400_000;
const APP_PAGE = 20;
const CONNECTED_MS = 10 * 60_000; // backstop for connections made outside this app
const cached = async <T>(key: string) =>
	(await db.select().from(appCache).where(eq(appCache.key, key)))[0] as
		| { data: T; updatedAt: Date }
		| undefined;
const store = (key: string, data: unknown) =>
	db
		.insert(appCache)
		.values({ key, data, updatedAt: new Date() })
		.onConflictDoUpdate({
			target: appCache.key,
			set: { data, updatedAt: new Date() },
		});
export const forget = (userId: string) =>
	db.delete(appCache).where(eq(appCache.key, `connected:${userId}`));
const tooMany = { error: "Too many requests" } as const;

// Every page of a session's toolkits (Composio allows 50 a page).
async function allToolkits(userId: string, isConnected?: true) {
	const session = await appSession(userId);
	const items = [];
	let cursor: string | undefined;
	do {
		const page = await session.toolkits({ limit: 50, cursor, isConnected });
		items.push(...page.items);
		cursor = page.cursor;
	} while (cursor);
	return items;
}

// ~1,900 apps, about 15 s from Composio: one refresh at a time for the whole server.
let refreshing: Promise<{ data: CatalogApp[]; updatedAt: Date }> | undefined;
// The slugs this user has connected: from app_cache, from Composio when missing,
// stale or `fresh` (Refresh, back from connecting).
export async function connectedSlugs(userId: string, fresh = false) {
	const key = `connected:${userId}`;
	const hit = fresh ? undefined : await cached<string[]>(key);
	if (hit && Date.now() - hit.updatedAt.getTime() <= CONNECTED_MS)
		return new Set(hit.data);
	const data = (await allToolkits(userId, true))
		.filter((t) => t.connection?.connectedAccount?.id)
		.map((t) => t.slug);
	await store(key, data);
	return new Set(data);
}
async function catalogFor(userId: string) {
	const catalog = await cached<CatalogApp[]>("catalog");
	if (!catalog) return (await refreshCatalog(userId)).data;
	if (Date.now() - catalog.updatedAt.getTime() > DAY)
		void refreshCatalog(userId).catch(() => {}); // stale: serve it, refresh behind
	return catalog.data;
}

const refreshCatalog = (userId: string) => {
	refreshing ??= allToolkits(userId)
		.then(async (items) => {
			const data = items
				// Not the integration itself, nor custom MCP toolkits: on the free plan those
				// are shared by every user, and each user sees only their own (mcp.ts).
				.filter((t) => t.slug !== "composio" && !CUSTOM.test(t.slug))
				.map((t) => ({ slug: t.slug, name: t.name, logo: t.logo }));
			await store("catalog", data);
			return { data, updatedAt: new Date() };
		})
		.finally(() => {
			refreshing = undefined;
		});
	return refreshing;
};

// Custom MCP toolkits (CUSTOM_…) are reachable here only by the user who added them.
const CUSTOM = /^custom_/i;
async function othersCustom(userId: string, slug: string) {
	if (!CUSTOM.test(slug)) return false;
	const mine = await listMcp(db, userId);
	return !mine.some((m) => m.slug.toLowerCase() === slug.toLowerCase());
}

const slug = zValidator(
	"param",
	z.object({ slug: z.string().min(1).max(100) }),
);

export const me = new Hono<Env>()
	.use(requireUser)
	// What the agent remembers about this user (Settings > Memory). `max` is the
	// limit, so the web app doesn't keep its own copy.
	.get("/memory", async (c) => {
		const content = await readMemory(db, c.get("user").id);
		return c.json({ content, max: MAX_MEMORY_CHARS }, 200);
	})
	// The user's edit replaces the whole note; the agent recalls it next turn.
	.put(
		"/memory",
		zValidator("json", z.object({ content: z.string().max(MAX_MEMORY_CHARS) })),
		async (c) => {
			const { content } = c.req.valid("json");
			return c.json(
				{ content: await replaceMemory(db, c.get("user").id, content) },
				200,
			);
		},
	)
	// The @ menu and Settings > Connected apps, from app_cache (never Composio per
	// keystroke): the user's connected apps, and one page of apps (`cursor` = next offset)
	// matching `q` and `status`. `refresh` re-reads connections from Composio.
	.get(
		"/apps/all",
		zValidator(
			"query",
			z.object({
				q: z.string().max(100).optional(),
				cursor: z.coerce.number().int().min(0).max(5000).optional(),
				refresh: z.literal("1").optional(),
				status: z.enum(["all", "connected"]).optional(),
			}),
		),
		async (c) => {
			const userId = c.get("user").id;
			const { q, cursor = 0, refresh, status = "all" } = c.req.valid("query");
			// Served from the DB, so 60 a minute is generous; the web app caches pages too.
			if (overLimitInMemory(`apps-list:${userId}`, 60, 60_000))
				return c.json(tooMany, 429);
			// A refresh is ~1-3 s of Composio calls: a few a minute, then the cached list.
			const fresh =
				!!refresh && !overLimitInMemory(`apps-refresh:${userId}`, 5, 60_000);
			const [catalog, on] = await Promise.all([
				catalogFor(userId),
				connectedSlugs(userId, fresh),
			]);
			const needle = q?.trim().toLowerCase();
			// Composio's own order (most used first). No `q`: every app.
			const found = catalog.filter(
				(a) =>
					(!needle ||
						a.name.toLowerCase().includes(needle) ||
						a.slug.includes(needle)) &&
					(status === "all" || on.has(a.slug)),
			);
			const page = found.slice(cursor, cursor + APP_PAGE);
			const mark = (a: CatalogApp) => ({ ...a, connected: on.has(a.slug) });
			return c.json(
				{
					connected: catalog.filter((a) => on.has(a.slug)).map(mark),
					apps: page.map(mark),
					cursor: cursor + APP_PAGE < found.length ? cursor + APP_PAGE : null,
				},
				200,
			);
		},
	)
	// One app's name, logo and connection, for the chat's connect card: from app_cache,
	// and from Composio only for an app missing from the catalog.
	.get("/apps/:slug", slug, async (c) => {
		const userId = c.get("user").id;
		const want = c.req.valid("param").slug;
		if (await othersCustom(userId, want))
			return c.json({ error: "Not found" }, 404);
		if (overLimitInMemory(`apps-one:${userId}`, 30, 60_000))
			return c.json(tooMany, 429);
		const [catalog, on] = await Promise.all([
			catalogFor(userId),
			connectedSlugs(userId),
		]);
		const hit = catalog.find((a) => a.slug === want);
		if (hit)
			return c.json(
				{ name: hit.name, logo: hit.logo ?? null, connected: on.has(want) },
				200,
			);
		// A session enabled for just that toolkit lists only it (configuring-sessions).
		const session = await composio().create(userId, {
			toolkits: [want],
			sandbox: { enable: false },
		});
		const [app] = (await session.toolkits()).items;
		if (!app) return c.json({ error: "Not found" }, 404);
		return c.json(
			{
				name: app.name,
				logo: app.logo ?? null,
				connected: !!app.connection?.connectedAccount?.id,
			},
			200,
		);
	})
	// A Composio Connect Link. Composio sends the user back to `returnTo` (a dashboard
	// page of this app only, so the link can't redirect anywhere else).
	.post(
		"/apps/:slug/connect",
		slug,
		zValidator(
			"json",
			z.object({ returnTo: z.string().regex(/^\/dashboard(\/[\w-]*)*$/) }),
		),
		async (c) => {
			if (await overLimit(db, `apps-change:${c.get("user").id}`, 10, 60_000))
				return c.json(tooMany, 429);
			if (await othersCustom(c.get("user").id, c.req.valid("param").slug))
				return c.json({ error: "Not found" }, 404);
			const session = await appSession(c.get("user").id);
			await forget(c.get("user").id); // read connections again when they're back
			const request = await session.authorize(c.req.valid("param").slug, {
				callbackUrl: `${webUrl}${c.req.valid("json").returnTo}`,
			});
			return c.json({ url: request.redirectUrl }, 200);
		},
	)
	// Only an account found in this user's own connected toolkits can be deleted.
	.delete("/apps/:slug", slug, async (c) => {
		if (await overLimit(db, `apps-change:${c.get("user").id}`, 10, 60_000))
			return c.json(tooMany, 429);
		const session = await appSession(c.get("user").id);
		const { items } = await session.toolkits({ isConnected: true });
		const id = items.find((t) => t.slug === c.req.valid("param").slug)
			?.connection?.connectedAccount?.id;
		if (!id) return c.json({ error: "Not found" }, 404);
		await composio().connectedAccounts.delete(id);
		await forget(c.get("user").id);
		return c.json({ ok: true }, 200);
	});
