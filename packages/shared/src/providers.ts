// Model providers the user brings their own credentials for (Settings > Model providers).
// The providers and models are a models.dev snapshot (provider-catalog.json, made by
// scripts/sync-providers.ts); each provider's AI SDK package is wired up in
// apps/ai-agent/agent/lib/providers.ts. Server-side only: the catalog is too big for
// the browser, which gets what it needs from GET /api/me/providers.
//
// A chosen model travels as one string, `byok:<provider>/<model id>`, beside the
// built-in OpenRouter models of models.ts (paid by K4).
//
// What a user saves is split in two: `secret` (keys, the service account) is encrypted
// at rest and only the agent decrypts it; `config` (region, project, base URL, model
// names) is plain, so the settings page can show it.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { type Effort, findModel, type ModelOption } from "./models";
import catalogJson from "./provider-catalog.json";

/** AI SDK packages that have an adapter (agent lib/providers.ts). The sync script checks this. */
export const ADAPTED_NPM = [
	"@ai-sdk/openai",
	"@ai-sdk/anthropic",
	"@ai-sdk/google",
	"@ai-sdk/xai",
	"@ai-sdk/mistral",
	"@ai-sdk/groq",
	"@ai-sdk/cerebras",
	"@ai-sdk/togetherai",
	"@ai-sdk/deepinfra",
	"@ai-sdk/cohere",
	"@ai-sdk/openai-compatible",
	"@openrouter/ai-sdk-provider",
	"@ai-sdk/amazon-bedrock",
	"@ai-sdk/google-vertex",
	"@ai-sdk/azure",
];
export const EFFORTS = [
	"none",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
] as const satisfies readonly Effort[];

/**
 * How a provider is signed in to, which decides its form fields:
 * key: one API key. template: an API key plus the values its URL needs (an account id).
 * bedrock: AWS region and access keys. vertex: a Google service account JSON.
 * azure: resource name, key, and the user's deployment names. custom: any
 * OpenAI-compatible https endpoint, with the user's model names.
 */
export type Kind =
	| "key"
	| "template"
	| "bedrock"
	| "vertex"
	| "azure"
	| "custom";

export type CatalogModel = {
	id: string;
	name: string;
	contextWindow: number;
	vision?: false;
	/** false: the model can't read PDFs; another model reads them for it (view_file). */
	pdf?: false;
	efforts?: Effort[];
	/** A base URL for this model only (models.dev model `provider.api`). */
	api?: string;
};
export type CatalogProvider = {
	id: string;
	name: string;
	npm: string;
	kind: Kind;
	/** Base URL (models.dev `api`); `${NAME}` parts are filled from the user's `vars`. */
	api?: string;
	/** Template providers: the names in `api` the user fills in. */
	vars?: string[];
	/** Where to get a key. */
	doc?: string;
	models: CatalogModel[];
};
export type Catalog = CatalogProvider[];

export const catalog = catalogJson as Catalog;

/** The one entry that isn't in models.dev: any OpenAI-compatible endpoint. */
export const CUSTOM: CatalogProvider = {
	id: "custom",
	name: "Custom endpoint",
	npm: "@ai-sdk/openai-compatible",
	kind: "custom",
	models: [],
};
const CUSTOM_ID = /^custom-[a-z][a-z0-9-]{1,29}$/;

/** A provider by id; `custom-<name>` ids are the user's own endpoints. */
export const findProvider = (id: unknown): CatalogProvider | undefined =>
	typeof id === "string" && CUSTOM_ID.test(id)
		? { ...CUSTOM, id }
		: catalog.find((p) => p.id === id);

export const PROVIDER_ID = /^[a-z0-9][a-z0-9.-]{0,39}$/;
const PREFIX = "byok:";
export const modelRef = (provider: string, model: string) =>
	`${PREFIX}${provider}/${model}`;

/** Models the user names themselves (custom endpoints, Azure deployments). */
const userNamed = (p: CatalogProvider) =>
	p.kind === "custom" || p.kind === "azure";

/**
 * The provider and model behind a `byok:` ref, or null. Catalog models must be in the
 * catalog; user-named ones only well-formed here, and checked against the user's saved
 * list by the agent.
 */
export function parseRef(ref: unknown) {
	if (typeof ref !== "string" || !ref.startsWith(PREFIX)) return null;
	const rest = ref.slice(PREFIX.length);
	const slash = rest.indexOf("/");
	const provider = findProvider(rest.slice(0, slash));
	const id = rest.slice(slash + 1);
	if (!provider) return null;
	if (userNamed(provider))
		return MODEL_NAME.test(id) ? { provider, model: userModel(id, 0) } : null;
	const model = provider.models.find((m) => m.id === id);
	return model ? { provider, model } : null;
}

// Unknown to us, so the safe choice: images and PDFs go through a model that reads them.
const userModel = (id: string, contextWindow: number): CatalogModel => ({
	id,
	name: id,
	contextWindow,
	vision: false,
	pdf: false,
});

/** A model in the shape the picker and agent use for built-in models. */
export const asOption = (p: CatalogProvider, m: CatalogModel): ModelOption => ({
	id: modelRef(p.id, m.id),
	name: m.name,
	description: p.name,
	provider: p.name,
	via: p.name,
	efforts: m.efforts ?? [],
	// User-named models: the real window is in the user's config (agent.ts reads it).
	contextWindow: m.contextWindow || 128_000,
	...(m.vision === false ? { vision: false as const } : {}),
	...(m.pdf === false ? { pdf: false as const } : {}),
});

/** Any model id the browser may send: a `byok:` ref, else the built-in allowlist. */
export function resolveModel(id: unknown): ModelOption {
	const hit = parseRef(id);
	return hit ? asOption(hit.provider, hit.model) : findModel(id);
}

/** The models a connected provider offers, from the catalog or the user's own list. */
export function providerModels(p: CatalogProvider, config: Config) {
	if (!userNamed(p)) return p.models;
	const window = Number(config.contextWindow) || 128_000;
	return (Array.isArray(config.models) ? config.models : []).map((m) =>
		userModel(m, window),
	);
}

// ---- The form: what each kind asks for, and checking what comes back.

export type Field = {
	name: string;
	label: string;
	/** secret: encrypted, never shown again. json: pasted file contents (also secret). */
	type: "secret" | "json" | "text" | "list" | "number";
	optional?: true;
	placeholder?: string;
};
export type Config = Record<string, string | number | string[]>;
export type Saved = {
	secret: Record<string, string>;
	config: Config;
	hint: string;
};

const label = (v: string) =>
	v
		.toLowerCase()
		.split("_")
		.map((w) => w[0].toUpperCase() + w.slice(1))
		.join(" ");

export function fieldsOf(p: CatalogProvider): Field[] {
	const key: Field = { name: "apiKey", label: "API key", type: "secret" };
	switch (p.kind) {
		case "key":
			return [key];
		case "template":
			return [
				...(p.vars ?? []).map(
					(v): Field => ({ name: v, label: label(v), type: "text" }),
				),
				key,
			];
		case "bedrock":
			return [
				{
					name: "region",
					label: "AWS region",
					type: "text",
					placeholder: "us-east-1",
				},
				{ name: "accessKeyId", label: "Access key ID", type: "secret" },
				{ name: "secretAccessKey", label: "Secret access key", type: "secret" },
			];
		case "vertex":
			return [
				{
					name: "serviceAccount",
					label: "Service account key (JSON)",
					type: "json",
				},
				{
					name: "location",
					label: "Location",
					type: "text",
					placeholder: "us-central1",
				},
				{
					name: "project",
					label: "Project ID",
					type: "text",
					optional: true,
					placeholder: "From the JSON when empty",
				},
			];
		case "azure":
			return [
				{ name: "resourceName", label: "Resource name", type: "text" },
				key,
				{
					name: "models",
					label: "Deployment names",
					type: "list",
					placeholder: "gpt-5, my-deployment",
				},
				CONTEXT,
			];
		case "custom":
			return [
				{
					name: "name",
					label: "Name",
					type: "text",
					placeholder: "my-server",
				},
				{
					name: "baseURL",
					label: "Base URL",
					type: "text",
					placeholder: "https://api.example.com/v1",
				},
				{ ...key, optional: true },
				{
					name: "models",
					label: "Model names",
					type: "list",
					placeholder: "llama-4-70b, qwen3-32b",
				},
				CONTEXT,
			];
	}
}
const CONTEXT: Field = {
	name: "contextWindow",
	label: "Context window (tokens)",
	type: "number",
	placeholder: "128000",
};

const TOKEN = /^\S{8,4000}$/;
const MODEL_NAME = /^[\w.:@/-]{1,200}$/;
// Each check: the value is fine, or what's wrong with it.
const RULES: Record<string, (v: string) => string | null> = {
	region: (v) =>
		/^[a-z]{2}(-[a-z]+)+-\d{1,2}$/.test(v) ? null : "Not an AWS region.",
	location: (v) =>
		/^[a-z][a-z0-9-]{1,39}$/.test(v) ? null : "Not a Google Cloud location.",
	project: (v) =>
		/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(v) ? null : "Not a project ID.",
	// Azure docs: "It must be a single DNS label".
	resourceName: (v) =>
		/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(v)
			? null
			: "A resource name is letters, digits and hyphens.",
	name: (v) =>
		/^[a-z][a-z0-9-]{1,29}$/.test(v)
			? null
			: "Lowercase letters, digits and hyphens, starting with a letter.",
	baseURL: baseUrlError,
};
// Template values go into a URL: one host label or path part, nothing that could
// change where the request goes.
const VAR = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/;

/** Why the agent may not call this URL, or null. Public https endpoints only. */
export function baseUrlError(raw: string): string | null {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return "That isn't a URL.";
	}
	if (url.protocol !== "https:") return "Use an https:// URL.";
	if (url.username || url.password || url.search || url.hash)
		return "Use the plain base URL, with no key, query or #.";
	const host = url.hostname.replace(/^\[|\]$/g, "");
	if (
		isIP(host) ||
		/^localhost$|\.(localhost|local|internal|lan|home|corp)$/i.test(host) ||
		!host.includes(".")
	)
		return "Use the server's public domain name.";
	return null;
}

/** A pasted Google service account: only its email and private key are kept. */
function serviceAccount(raw: string) {
	if (raw.length > 20_000) return null;
	let j: unknown;
	try {
		j = JSON.parse(raw);
	} catch {
		return null;
	}
	const o = j as Record<string, unknown>;
	// Only a service account: other Google credential files ("external_account")
	// tell the auth library to read files, call URLs or run programs on our server.
	if (
		o?.type !== "service_account" ||
		typeof o.client_email !== "string" ||
		!/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(o.client_email) ||
		typeof o.private_key !== "string" ||
		!o.private_key.startsWith("-----BEGIN PRIVATE KEY-----")
	)
		return null;
	return {
		client_email: o.client_email,
		private_key: o.private_key,
		project: typeof o.project_id === "string" ? o.project_id : "",
	};
}

/** Checks a submitted form for provider `p`; returns what to save, or the problem. */
export function checkCredentials(
	p: CatalogProvider,
	input: Record<string, unknown>,
): Saved | { error: string; field?: string } {
	const secret: Record<string, string> = {};
	const config: Config = {};
	for (const f of fieldsOf(p)) {
		const raw = input[f.name];
		const v = typeof raw === "string" ? raw.trim() : "";
		if (!v) {
			if (f.optional) continue;
			return { error: `${f.label} is required.`, field: f.name };
		}
		if (f.type === "secret") {
			if (!TOKEN.test(v))
				return { error: `That doesn't look like a ${f.label}.`, field: f.name };
			secret[f.name] = v;
		} else if (f.type === "json") {
			const sa = serviceAccount(v);
			if (!sa)
				return {
					error:
						"Paste a service account key file (JSON, type service_account).",
					field: f.name,
				};
			secret.client_email = sa.client_email;
			secret.private_key = sa.private_key;
			if (sa.project && !input.project) config.project = sa.project;
		} else if (f.type === "list") {
			const list = [...new Set(v.split(/[\s,]+/).filter(Boolean))];
			if (
				!list.length ||
				list.length > 50 ||
				!list.every((m) => MODEL_NAME.test(m))
			)
				return {
					error: "List up to 50 names, separated by commas.",
					field: f.name,
				};
			config[f.name] = list;
		} else if (f.type === "number") {
			const n = Number(v);
			if (!Number.isInteger(n) || n < 4_000 || n > 10_000_000)
				return {
					error: "A whole number of tokens, 4,000 to 10,000,000.",
					field: f.name,
				};
			config[f.name] = n;
		} else {
			const rule = RULES[f.name];
			const bad = rule ? rule(v) : VAR.test(v) ? null : "Not a valid value.";
			if (bad) return { error: bad, field: f.name };
			config[f.name] = v;
		}
	}
	if (p.kind === "vertex" && !config.project)
		return { error: "Project ID is required.", field: "project" };
	if (p.kind === "vertex" && RULES.project(String(config.project)))
		return { error: "Not a project ID.", field: "project" };
	// Shown in Settings so the user knows which key is saved: never more than 4 characters.
	const main = secret.apiKey ?? secret.secretAccessKey;
	const hint = main
		? `…${main.slice(-4)}`
		: String(config.project ?? config.name ?? "saved");
	return { secret, config, hint };
}

/** A provider's base URL with the user's values filled in (template providers). */
export const fillUrl = (url: string, config: Config) =>
	url.replace(/\$\{(\w+)\}/g, (_, k: string) => {
		const v = String(config[k] ?? "");
		if (!VAR.test(v)) throw new Error(`Missing ${k}`);
		return v;
	});

// ---- Secrets at rest: AES-256-GCM, bound to the user and provider (as associated
// data), so a row copied to another user or provider fails to decrypt.
// PROVIDER_KEY_SECRET is 32 random bytes, base64 (`openssl rand -base64 32`), the same
// in backend and agent. Losing it makes every saved key unreadable: keep it in a secret
// manager. To rotate: move the old value to PROVIDER_KEY_SECRET_PREVIOUS, set a new one,
// deploy, run `bun run providers:reseal` in apps/backend, then drop the previous value.
function masterKey(name = "PROVIDER_KEY_SECRET") {
	const key = Buffer.from(process.env[name] ?? "", "base64");
	if (key.length !== 32) throw new Error(`${name} must be 32 bytes, base64`);
	return key;
}
const aad = (userId: string, provider: string) =>
	Buffer.from(`${userId}\n${provider}`);

export function encryptKey(userId: string, provider: string, plain: string) {
	const iv = randomBytes(12);
	const c = createCipheriv("aes-256-gcm", masterKey(), iv);
	c.setAAD(aad(userId, provider));
	const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
	return `v1:${Buffer.concat([iv, c.getAuthTag(), body]).toString("base64")}`;
}

export function decryptKey(userId: string, provider: string, sealed: string) {
	if (!sealed.startsWith("v1:")) throw new Error("Unknown key format");
	const raw = Buffer.from(sealed.slice(3), "base64");
	const open = (key: Buffer) => {
		const d = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
		d.setAAD(aad(userId, provider));
		d.setAuthTag(raw.subarray(12, 28));
		return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString(
			"utf8",
		);
	};
	try {
		return open(masterKey());
	} catch (e) {
		// Sealed before a rotation: the previous key opens it until `providers:reseal` runs.
		if (!process.env.PROVIDER_KEY_SECRET_PREVIOUS) throw e;
		return open(masterKey("PROVIDER_KEY_SECRET_PREVIOUS"));
	}
}
