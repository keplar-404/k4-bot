// The user's own model providers (@repo/shared/providers): one adapter per AI SDK
// package, each set up as its docs say (ai-sdk.dev/providers, "Provider Instance").
// Every credential is passed explicitly: left out, these packages read the server's own
// environment (OPENAI_API_KEY, AWS_*, GOOGLE_VERTEX_*, AZURE_*) instead.
// Packages load on first use, so unused ones stay out of each turn's startup.
// To add a package: read its docs, add it here and to ADAPTED_NPM, then run the sync.
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { BlockList, isIP, type LookupFunction } from "node:net";
import {
	ADAPTED_NPM,
	type CatalogModel,
	type CatalogProvider,
	type Config,
	fillUrl,
} from "@repo/shared/providers";
import type { LanguageModel } from "ai";

export type Creds = { secret: Record<string, string>; config: Config };
type Make = (
	p: CatalogProvider,
	m: CatalogModel,
	c: Creds,
) => Promise<LanguageModel>;

// One API key and a base URL: the model's own, the provider's (filled in), or the user's.
const keyed = (p: CatalogProvider, m: CatalogModel, c: Creds) => ({
	apiKey: need(c.secret.apiKey, "API key"),
	baseURL: m.api ?? (p.api ? fillUrl(p.api, c.config) : undefined),
});

const ADAPTERS: Record<string, Make> = {
	// Default factory uses the Responses API (docs: OpenAI > Language Models).
	"@ai-sdk/openai": async (p, m, c) =>
		(await import("@ai-sdk/openai")).createOpenAI(keyed(p, m, c))(m.id),
	"@ai-sdk/anthropic": async (p, m, c) =>
		(await import("@ai-sdk/anthropic")).createAnthropic(keyed(p, m, c))(m.id),
	"@ai-sdk/google": async (p, m, c) =>
		(await import("@ai-sdk/google")).createGoogle(keyed(p, m, c))(m.id),
	"@ai-sdk/xai": async (p, m, c) =>
		(await import("@ai-sdk/xai")).createXai(keyed(p, m, c))(m.id),
	"@ai-sdk/mistral": async (p, m, c) =>
		(await import("@ai-sdk/mistral")).createMistral(keyed(p, m, c))(m.id),
	"@ai-sdk/groq": async (p, m, c) =>
		(await import("@ai-sdk/groq")).createGroq(keyed(p, m, c))(m.id),
	"@ai-sdk/cerebras": async (p, m, c) =>
		(await import("@ai-sdk/cerebras")).createCerebras(keyed(p, m, c))(m.id),
	"@ai-sdk/togetherai": async (p, m, c) =>
		(await import("@ai-sdk/togetherai")).createTogetherAI(keyed(p, m, c))(m.id),
	"@ai-sdk/deepinfra": async (p, m, c) =>
		(await import("@ai-sdk/deepinfra")).createDeepInfra(keyed(p, m, c))(m.id),
	"@ai-sdk/cohere": async (p, m, c) =>
		(await import("@ai-sdk/cohere")).createCohere(keyed(p, m, c))(m.id),
	// includeUsage: token counts in streams, which the budget prompt (agent.ts) needs.
	// A custom endpoint is any URL the user typed: it gets the guarded fetch below.
	"@ai-sdk/openai-compatible": async (p, m, c) => {
		const custom = p.kind === "custom";
		const baseURL = custom
			? need(String(c.config.baseURL ?? ""), "base URL")
			: need(keyed(p, m, c).baseURL, "base URL");
		return (await import("@ai-sdk/openai-compatible")).createOpenAICompatible({
			name: p.id,
			baseURL,
			// Custom endpoints may have no key; catalog providers always do.
			apiKey: custom ? c.secret.apiKey : keyed(p, m, c).apiKey,
			includeUsage: true,
			...(custom ? { fetch: publicFetch } : {}),
		})(m.id);
	},
	// Community provider docs use `.chat(id)`.
	"@openrouter/ai-sdk-provider": async (p, m, c) =>
		(await import("@openrouter/ai-sdk-provider"))
			.createOpenRouter({ apiKey: keyed(p, m, c).apiKey })
			.chat(m.id),
	// Docs: with both access keys as strings, no session token is read from the env.
	"@ai-sdk/amazon-bedrock": async (_p, m, c) =>
		(await import("@ai-sdk/amazon-bedrock")).createAmazonBedrock({
			region: need(String(c.config.region ?? ""), "region"),
			accessKeyId: need(c.secret.accessKeyId, "access key ID"),
			secretAccessKey: need(c.secret.secretAccessKey, "secret access key"),
		})(m.id),
	// Node runtime, service account credentials (docs: Google Vertex > Node.js Runtime).
	"@ai-sdk/google-vertex": async (_p, m, c) =>
		(await import("@ai-sdk/google-vertex")).createGoogleVertex({
			project: need(String(c.config.project ?? ""), "project"),
			location: need(String(c.config.location ?? ""), "location"),
			googleAuthOptions: {
				credentials: {
					client_email: need(c.secret.client_email, "service account"),
					private_key: need(c.secret.private_key, "service account"),
				},
			},
		})(m.id),
	// The model id is the user's deployment name (docs: Azure > Language Models).
	"@ai-sdk/azure": async (_p, m, c) =>
		(await import("@ai-sdk/azure")).createAzure({
			resourceName: need(String(c.config.resourceName ?? ""), "resource name"),
			apiKey: need(c.secret.apiKey, "API key"),
		})(m.id),
};

// Every package the catalog may name has an adapter (the sync script checks the other side).
for (const npm of ADAPTED_NPM)
	if (!ADAPTERS[npm]) throw new Error(`No adapter for ${npm}`);

function need<T>(v: T | undefined, what: string): T {
	if (!v) throw new Error(`Missing ${what} for this provider.`);
	return v;
}

/** A language model for one provider and model, called with the user's credentials. */
export function userModel(p: CatalogProvider, m: CatalogModel, creds: Creds) {
	return ADAPTERS[p.npm](p, m, creds);
}

// ---- Custom endpoints: the agent runs on our servers, so a URL the user typed must not
// reach our own network (cloud metadata, databases, other services). Saving checks the
// URL's form (baseUrlError); here the socket's own DNS lookup refuses private addresses,
// so the address checked is the address connected to (no DNS rebinding), and redirects
// are refused.
const PRIVATE = new BlockList();
for (const [net, bits] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["224.0.0.0", 3],
] as const)
	PRIVATE.addSubnet(net, bits, "ipv4");
// IPv4-mapped IPv6 (::ffff:a.b.c.d) is checked against the IPv4 rules by BlockList.
for (const [net, bits] of [
	["::", 127],
	["fc00::", 7],
	["fe80::", 10],
	["ff00::", 8],
	["64:ff9b::", 96],
] as const)
	PRIVATE.addSubnet(net, bits, "ipv6");

const isPrivate = (address: string, family: number) =>
	PRIVATE.check(address, family === 6 ? "ipv6" : "ipv4");

export async function isPublicHost(host: string) {
	const bare = host.replace(/^\[|\]$/g, "");
	const addrs = isIP(bare)
		? [{ address: bare, family: isIP(bare) }]
		: await lookup(bare, { all: true }).catch(() => []);
	return addrs.length > 0 && !addrs.some((a) => isPrivate(a.address, a.family));
}

/** net.connect's `lookup` (Node docs, socket.connect options): every answer must be public. */
export const publicLookup = ((host, options, callback) =>
	dnsLookup(host, { ...options, all: true }, (err, addrs) => {
		if (err) return callback(err, "", 0);
		if (!addrs.length || addrs.some((a) => isPrivate(a.address, a.family)))
			return callback(
				Object.assign(new Error(`${host} is not a public address`), {
					code: "EPRIVATE",
				}),
				"",
				0,
			);
		if (options.all) return (callback as AllCallback)(null, addrs);
		callback(null, addrs[0].address, addrs[0].family);
	})) as LookupFunction;
type AllCallback = (err: null, addrs: LookupAddress[]) => void;

let pinned: import("undici").Agent | undefined;
export const publicFetch = async (
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> => {
	const url = new URL(input instanceof Request ? input.url : String(input));
	if (url.protocol !== "https:" || !(await isPublicHost(url.hostname)))
		throw new Error("That endpoint isn't a public https address.");
	const { Agent, fetch } = await import("undici");
	// Docs (undici Client `connect`): every tls.connect option, so `lookup` too.
	pinned ??= new Agent({ connect: { lookup: publicLookup } });
	return (await fetch(input as Parameters<typeof fetch>[0], {
		...(init as Parameters<typeof fetch>[1]),
		redirect: "error",
		dispatcher: pinned,
	})) as unknown as Response;
};
