// The user's own MCP servers (Settings > Custom connectors), for apps Composio's catalog
// doesn't have. Composio hosts them as Custom MCP toolkits (docs: extending-sessions/
// custom-mcp): it keeps each user's key or sign-in, refreshes tokens, and makes the
// calls, so K4 never connects to a user's server itself. user_mcp only records which
// user added which toolkit.
//
// Free (Hobby) plan: a custom toolkit is shared by every user of the Composio project,
// one per URL. Users still connect their own accounts, but every session would see
// every toolkit, so each session hides the ones this user didn't add (hiddenCustom).
// On Pro, toolkits can be private (user_id = the user) and that step goes away.
import { and, eq, ne, notInArray } from "drizzle-orm";
import type { Db } from "./db";
import { userMcp } from "./schema";

export const MCP_NAME = /^[a-z][a-z0-9-]{1,29}$/;
export const MAX_MCP_PER_USER = 20;
export type McpAuth = "none" | "key" | "oauth";

/** The servers the user picked with @ for one message: valid names only, no repeats, at most the per-user cap. */
export const pickedMcp = (raw: unknown): string[] =>
	Array.isArray(raw)
		? [
				...new Set(
					raw.filter(
						(n): n is string => typeof n === "string" && MCP_NAME.test(n),
					),
				),
			].slice(0, MAX_MCP_PER_USER)
		: [];

/** Why Composio can't use this URL, or null. It must be a public https endpoint. */
export function mcpUrlError(raw: string): string | null {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return "That isn't a URL.";
	}
	if (url.protocol !== "https:") return "Use an https:// URL.";
	if (url.username || url.password || /key|token|secret/i.test(url.search))
		return "Don't put a key in the URL: choose API key, and you'll enter it when you connect.";
	if (/^(localhost|[\d.]+|\[.*\])$/.test(url.hostname))
		return "Use the server's public address.";
	return null;
}

// ---- Rows.
export const listMcp = (db: Db, userId: string) =>
	db
		.select({
			name: userMcp.name,
			url: userMcp.url,
			slug: userMcp.slug,
			auth: userMcp.auth,
		})
		.from(userMcp)
		.where(eq(userMcp.userId, userId));

/** Custom toolkits other users added and this one didn't: hidden from this user's sessions. */
export async function hiddenCustom(db: Db, userId: string) {
	const mine = db
		.select({ slug: userMcp.slug })
		.from(userMcp)
		.where(eq(userMcp.userId, userId));
	const rows = await db
		.selectDistinct({ slug: userMcp.slug })
		.from(userMcp)
		.where(and(ne(userMcp.userId, userId), notInArray(userMcp.slug, mine)));
	return rows.map((r) => r.slug);
}

/** Whether any user still has this toolkit (it is deleted at Composio when none does). */
export async function slugInUse(db: Db, slug: string) {
	const [row] = await db
		.select({ slug: userMcp.slug })
		.from(userMcp)
		.where(eq(userMcp.slug, slug))
		.limit(1);
	return !!row;
}

// ---- Composio's Custom MCP API (v3.1). @composio/core 0.31 has no methods for it.
const API = "https://backend.composio.dev/api/v3.1";
export class ComposioError extends Error {}

async function call(path: string, init?: RequestInit) {
	const res = await fetch(`${API}${path}`, {
		...init,
		signal: AbortSignal.timeout(30_000),
		headers: {
			"x-api-key": process.env.COMPOSIO_API_KEY ?? "",
			"content-type": "application/json",
		},
	});
	const body = (await res.json().catch(() => null)) as Record<
		string,
		unknown
	> | null;
	return { status: res.status, body };
}

const SCHEMES = {
	NO_AUTH: "none",
	API_KEY: "key",
	DCR_OAUTH: "oauth",
} as const;

/**
 * The toolkit for `url`: created, or the one that already exists for it (one per URL
 * on the free plan; its auth stays as first chosen). API keys are typed on Composio's
 * connect page, never sent to K4: `{{generic_api_key}}` is where Composio puts each
 * user's key. Sign-in needs the server to allow client registration (DCR).
 */
export async function ensureToolkit(o: {
	name: string;
	url: string;
	auth: McpAuth;
	header?: string;
}): Promise<{ slug: string; auth: McpAuth }> {
	const header = o.header ?? "Authorization";
	const scheme =
		o.auth === "key"
			? {
					mode: "API_KEY",
					headers: {
						[header]: /^authorization$/i.test(header)
							? "Bearer {{generic_api_key}}"
							: "{{generic_api_key}}",
					},
				}
			: o.auth === "oauth"
				? {
						mode: "DCR_OAUTH",
						discovery_url: `${new URL(o.url).origin}/.well-known/oauth-authorization-server`,
					}
				: { mode: "NO_AUTH" };
	const r = await call("/custom/toolkits", {
		method: "POST",
		body: JSON.stringify({
			name: o.name,
			mcp_url: o.url,
			auth_schemes: [scheme],
			user_id: "all",
		}),
	});
	if (r.status === 200 && typeof r.body?.slug === "string")
		return { slug: r.body.slug, auth: o.auth };
	if (r.status === 409) {
		const found = await findToolkit(o.url);
		if (found) return found;
	}
	// Composio can refuse a server (400) yet keep the toolkit it made; a later add of
	// the same URL would then reuse that broken one. No other user had it (that's a 409).
	if (r.status === 400) {
		const orphan = await findToolkit(o.url).catch(() => null);
		if (orphan) await deleteToolkit(orphan.slug).catch(() => {});
	}
	const message = (r.body?.error as { message?: unknown } | undefined)?.message;
	throw new ComposioError(
		r.status === 400 && typeof message === "string"
			? `Composio refused the server: ${message}`
			: "Composio couldn't add the server. Check the URL and try again.",
	);
}

/** The shared custom toolkit already made for this URL. */
async function findToolkit(url: string) {
	const r = await call("/toolkits?type=custom&limit=1000");
	type Item = {
		slug: string;
		auth_schemes?: string[];
		meta?: { app_url?: string };
	};
	const hit = ((r.body?.items as Item[] | undefined) ?? []).find(
		(t) => t.meta?.app_url === url,
	);
	if (!hit) return null;
	const mode = hit.auth_schemes?.[0] as keyof typeof SCHEMES | undefined;
	return {
		slug: hit.slug.toUpperCase(),
		auth: (mode && SCHEMES[mode]) ?? ("none" as McpAuth),
	};
}

/** Deletes the toolkit, its tools and everyone's connections to it (Composio revokes them). */
export async function deleteToolkit(slug: string) {
	const r = await call(`/custom/toolkits/${encodeURIComponent(slug)}`, {
		method: "DELETE",
	});
	if (r.status !== 200 && r.status !== 404)
		throw new ComposioError("Composio couldn't delete the server.");
}

/** The toolkit's tools (slug and one-line description), for the agent's instructions. */
export async function toolkitTools(slug: string) {
	const r = await call(
		`/tools?toolkit_slug=${encodeURIComponent(slug)}&toolkit_versions=latest&limit=100`,
	);
	type Tool = {
		slug: string;
		description?: string;
		input_parameters?: {
			properties?: Record<string, { type?: string }>;
			required?: string[];
		};
	};
	return ((r.body?.items as Tool[] | undefined) ?? []).map((t) => {
		const p = t.input_parameters;
		// Inputs as "name: type" (required ones marked *), so the model can call it at once.
		const inputs = Object.entries(p?.properties ?? {})
			.map(
				([k, v]) =>
					`${k}${p?.required?.includes(k) ? "*" : ""}: ${v.type ?? "any"}`,
			)
			.join(", ");
		return {
			slug: t.slug,
			description: (t.description ?? "").split("\n")[0].slice(0, 200),
			inputs: inputs.slice(0, 400),
		};
	});
}
