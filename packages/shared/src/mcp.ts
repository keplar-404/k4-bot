// Each user's own MCP servers (Settings > Connectors), for servers Composio doesn't have.
// The backend checks and saves them; the agent connects (agent/connections/custom_mcp.ts).
// An API key is write-only: encrypted here, never returned, only deleted.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { and, eq } from "drizzle-orm";
import type { Db } from "./db";
import { userMcp } from "./schema";

export const MCP_NAME = /^[a-z][a-z0-9-]{1,29}$/;
export const MAX_MCP_PER_USER = 20;
/** The eve connection name: `mcp-<name>`, so it can't clash with apps or tools. */
export const connectionName = (name: string) => `mcp-${name}`;

// ---- The key, AES-256-GCM. MCP_SECRET_KEY: 32 random bytes, base64 (openssl rand -base64 32).
// Bound to user and server, so a row copied to another user or name won't decrypt.
const secret = () => {
	const k = Buffer.from(process.env.MCP_SECRET_KEY ?? "", "base64");
	if (k.length !== 32)
		throw new Error("MCP_SECRET_KEY must be 32 bytes, base64");
	return k;
};
export function sealKey(plain: string, userId: string, name: string) {
	const iv = randomBytes(12);
	const c = createCipheriv("aes-256-gcm", secret(), iv);
	c.setAAD(Buffer.from(`${userId}\0${name}`));
	const body = Buffer.concat([
		c.update(plain, "utf8"),
		c.final(),
		c.getAuthTag(),
	]);
	return `v1.${iv.toString("base64url")}.${body.toString("base64url")}`;
}
export function openKey(sealed: string, userId: string, name: string) {
	const [v, iv, body] = sealed.split(".");
	if (v !== "v1" || !iv || !body) throw new Error("bad sealed key");
	const raw = Buffer.from(body, "base64url");
	const d = createDecipheriv(
		"aes-256-gcm",
		secret(),
		Buffer.from(iv, "base64url"),
	);
	d.setAAD(Buffer.from(`${userId}\0${name}`));
	d.setAuthTag(raw.subarray(-16));
	return Buffer.concat([d.update(raw.subarray(0, -16)), d.final()]).toString(
		"utf8",
	);
}

/** The header a key is sent in: `Bearer <key>` for Authorization, the key as is otherwise. */
export function keyHeader(header: string, key: string) {
	const isAuth = header.toLowerCase() === "authorization";
	return {
		[header]: isAuth && !/^\w+ /.test(key) ? `Bearer ${key}` : key,
	};
}

// ---- The URL: public https only, so a user can't make the server call itself or its network.
const privateV4 = (ip: string) => {
	const [a, b] = ip.split(".").map(Number);
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		a >= 224 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168)
	);
};
export const privateIp = (ip: string) => {
	const v = ip.toLowerCase();
	if (isIP(v) === 4) return privateV4(v);
	const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
	if (mapped) return privateV4(mapped[1]);
	return v === "::" || v === "::1" || /^(fc|fd|fe[89ab])/.test(v);
};
/** An error message, or null when the URL is a public https endpoint. */
export async function checkMcpUrl(raw: string): Promise<string | null> {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return "That isn't a URL.";
	}
	// Development only: a server on this machine (http or https), e.g. http://localhost:3001/mcp.
	if (
		process.env.NODE_ENV !== "production" &&
		["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
		/^https?:$/.test(url.protocol)
	)
		return null;
	if (url.protocol !== "https:") return "Use an https:// URL.";
	if (url.username || url.password)
		return "Put the key in the key field, not the URL.";
	const host = url.hostname.replace(/^\[|\]$/g, "");
	if (host === "localhost" || /\.(local|internal|localhost)$/.test(host))
		return "Only public servers can be added.";
	const ips = isIP(host)
		? [host]
		: await lookup(host, { all: true })
				.then((r) => r.map((x) => x.address))
				.catch(() => []);
	if (!ips.length) return "That server's address can't be found.";
	if (ips.some(privateIp)) return "Only public servers can be added.";
	return null;
}

/** Calls `initialize`: the server's name, instructions and icon, or why it failed. */
export async function probeMcp(url: string, headers: Record<string, string>) {
	const res = await fetch(url, {
		method: "POST",
		redirect: "manual", // a redirect could point anywhere, including inside
		signal: AbortSignal.timeout(10_000),
		headers: {
			...headers,
			"content-type": "application/json",
			accept: "application/json, text/event-stream",
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-06-18",
				capabilities: {},
				clientInfo: { name: "assistant", version: "1.0.0" },
			},
		}),
	}).catch(() => null);
	if (!res) return { error: "The server didn't answer." };
	if (res.status === 401 || res.status === 403)
		return { error: "The server refused the key (or needs one)." };
	if (!res.ok) return { error: `The server answered ${res.status}.` };
	const text = (await res.text()).slice(0, 200_000);
	// Streamable HTTP may answer as SSE: the JSON is on a `data:` line.
	const json = text.trimStart().startsWith("{")
		? text
		: text
				.split("\n")
				.find((l) => l.startsWith("data:"))
				?.slice(5);
	type Init = {
		result?: {
			serverInfo?: {
				name?: string;
				title?: string;
				icons?: { src?: string }[];
			};
			instructions?: string;
		};
	};
	let body: Init | undefined;
	try {
		body = JSON.parse(json ?? "") as Init;
	} catch {}
	const r = body?.result;
	if (!r) return { error: "That isn't an MCP server." };
	const icon = r.serverInfo?.icons?.find((i) =>
		i.src?.startsWith("https://"),
	)?.src;
	return {
		title: r.serverInfo?.title ?? r.serverInfo?.name,
		instructions: r.instructions?.slice(0, 300),
		logo:
			icon ??
			`https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`,
	};
}

// ---- Rows. The agent reads the key only through mcpKey(), never in a list.
export const listMcp = (db: Db, userId: string) =>
	db
		.select({
			name: userMcp.name,
			url: userMcp.url,
			header: userMcp.header,
			description: userMcp.description,
			logo: userMcp.logo,
		})
		.from(userMcp)
		.where(eq(userMcp.userId, userId));

export async function mcpKey(db: Db, userId: string, name: string) {
	const [row] = await db
		.select({ header: userMcp.header, key: userMcp.key })
		.from(userMcp)
		.where(and(eq(userMcp.userId, userId), eq(userMcp.name, name)));
	return row?.header && row.key
		? keyHeader(row.header, openKey(row.key, userId, name))
		: {};
}
