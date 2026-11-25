// Model providers the user pays for with their own credentials (@repo/shared/providers).
// Secrets go in once and never come back out: only the agent decrypts them.
//   GET    /api/me/providers      -> every provider with its form fields, what the user
//                                    saved (plain settings and a 4-character hint), and
//                                    the connected providers' models (picker rows)
//   PUT    /api/me/providers/:id  -> save (or replace) one provider's details;
//                                    `custom-<name>` adds a custom endpoint
//   DELETE /api/me/providers/:id  -> forget them
import { zValidator } from "@hono/zod-validator";
import {
	asOption,
	CUSTOM,
	catalog,
	checkCredentials,
	encryptKey,
	fieldsOf,
	findProvider,
	PROVIDER_ID,
	providerModels,
} from "@repo/shared/providers";
import { overLimit } from "@repo/shared/rate-limit";
import { userProviderKey } from "@repo/shared/schema";
import { and, count, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { type Env, requireUser } from "./auth";
import { db } from "./db";

const MAX_PER_USER = 60;
const idParam = zValidator(
	"param",
	z.object({ id: z.string().regex(PROVIDER_ID) }),
);
const mine = (userId: string, provider: string) =>
	and(
		eq(userProviderKey.userId, userId),
		eq(userProviderKey.provider, provider),
	);

export const providers = new Hono<Env>()
	.use(requireUser)
	// Never cached by the browser or a proxy: these answers describe saved credentials.
	.use(async (c, next) => {
		await next();
		c.header("Cache-Control", "no-store");
	})
	.get("/", async (c) => {
		const rows = await db
			.select({
				provider: userProviderKey.provider,
				hint: userProviderKey.hint,
				config: userProviderKey.config,
			})
			.from(userProviderKey)
			.where(eq(userProviderKey.userId, c.get("user").id));
		const saved = new Map(rows.map((r) => [r.provider, r]));
		const own = rows.filter((r) => r.provider.startsWith("custom-"));
		const list = [
			...catalog,
			...own.flatMap((r) => findProvider(r.provider) ?? []),
			CUSTOM, // the "add a custom endpoint" form
		];
		return c.json(
			{
				providers: list.map((p) => {
					const s = saved.get(p.id);
					return {
						id: p.id,
						name: p.kind === "custom" && s ? String(s.config.name) : p.name,
						kind: p.kind,
						doc: p.doc ?? null,
						models: p.models.length,
						fields: fieldsOf(p),
						saved: s ? { hint: s.hint, config: s.config } : null,
					};
				}),
				models: list.flatMap((p) => {
					const s = saved.get(p.id);
					if (!s) return [];
					const named =
						p.kind === "custom" ? { ...p, name: String(s.config.name) } : p;
					return providerModels(p, s.config).map((m) => asOption(named, m));
				}),
			},
			200,
		);
	})
	.put(
		"/:id",
		idParam,
		// Field values only; checkCredentials knows each provider's fields and limits.
		zValidator(
			"json",
			z.object({
				values: z
					.record(z.string().max(40), z.string().max(20_000))
					.refine((v) => Object.keys(v).length <= 12),
			}),
		),
		async (c) => {
			const userId = c.get("user").id;
			const { id } = c.req.valid("param");
			const p = findProvider(id);
			if (!p || p.id === "custom") return c.json({ error: "Not found" }, 404);
			if (await overLimit(db, `provider-save:${userId}`, 20, 60 * 60_000))
				return c.json({ error: "Too many changes. Try again later." }, 429);
			const { values } = c.req.valid("json");
			const checked = checkCredentials(p, values);
			if ("error" in checked)
				return c.json({ error: checked.error, field: checked.field }, 400);
			// A custom endpoint's id is its name.
			if (p.kind === "custom" && `custom-${checked.config.name}` !== id)
				return c.json({ error: "The name doesn't match.", field: "name" }, 400);
			// The cap counts new providers only; replacing a saved one is always fine.
			const [{ n, existing }] = await db
				.select({
					n: count(),
					existing: sql<
						boolean | null
					>`bool_or(${userProviderKey.provider} = ${id})`,
				})
				.from(userProviderKey)
				.where(eq(userProviderKey.userId, userId));
			if (!existing && n >= MAX_PER_USER)
				return c.json({ error: `At most ${MAX_PER_USER} providers.` }, 409);
			const row = {
				sealed: encryptKey(userId, id, JSON.stringify(checked.secret)),
				hint: checked.hint,
				config: checked.config,
			};
			await db
				.insert(userProviderKey)
				.values({ userId, provider: id, ...row })
				.onConflictDoUpdate({
					target: [userProviderKey.userId, userProviderKey.provider],
					set: { ...row, createdAt: new Date() },
				});
			return c.json({ ok: true, hint: row.hint, config: row.config }, 200);
		},
	)
	.delete("/:id", idParam, async (c) => {
		const [row] = await db
			.delete(userProviderKey)
			.where(mine(c.get("user").id, c.req.valid("param").id))
			.returning({ provider: userProviderKey.provider });
		if (!row) return c.json({ error: "Not found" }, 404);
		return c.json({ ok: true }, 200);
	});
