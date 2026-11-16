import { Composio } from "@composio/core";
import { zValidator } from "@hono/zod-validator";
import {
	MAX_MEMORY_CHARS,
	readMemory,
	replaceMemory,
} from "@repo/shared/memory";
import { Hono } from "hono";
import { z } from "zod";
import { type Env, requireUser, webUrl } from "./auth";
import { db } from "./db";

// Composio Platform: the Composio user is the Neon Auth user id, as in the agent's
// connection. Docs: configuring-sessions > toolkits() / authorize().
// Created on first use, so the app (and its tests) load without COMPOSIO_API_KEY.
let client: Composio | undefined;
const composio = () => {
	client ??= new Composio();
	return client;
};
const appSession = (userId: string) =>
	composio().create(userId, { sandbox: { enable: false } });
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
	// Settings > Connected apps: apps with logo and connection, 20 per page.
	.get(
		"/apps",
		zValidator("query", z.object({ cursor: z.string().max(500).optional() })),
		async (c) => {
			const session = await appSession(c.get("user").id);
			const { items, cursor } = await session.toolkits({
				limit: 20,
				cursor: c.req.valid("query").cursor,
			});
			return c.json(
				{
					apps: items.map((t) => ({
						slug: t.slug,
						name: t.name,
						logo: t.logo,
						connected: !!t.connection?.connectedAccount?.id,
					})),
					cursor: cursor ?? null,
				},
				200,
			);
		},
	)
	// One app's name and logo, for the chat's connect card: a session enabled for just
	// that toolkit lists only it (configuring-sessions > toolkits()).
	.get("/apps/:slug", slug, async (c) => {
		const session = await composio().create(c.get("user").id, {
			toolkits: [c.req.valid("param").slug],
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
			const session = await appSession(c.get("user").id);
			const request = await session.authorize(c.req.valid("param").slug, {
				callbackUrl: `${webUrl}${c.req.valid("json").returnTo}`,
			});
			return c.json({ url: request.redirectUrl }, 200);
		},
	)
	// Only an account found in this user's own connected toolkits can be deleted.
	.delete("/apps/:slug", slug, async (c) => {
		const session = await appSession(c.get("user").id);
		const { items } = await session.toolkits({ isConnected: true });
		const id = items.find((t) => t.slug === c.req.valid("param").slug)
			?.connection?.connectedAccount?.id;
		if (!id) return c.json({ error: "Not found" }, 404);
		await composio().connectedAccounts.delete(id);
		return c.json({ ok: true }, 200);
	});
