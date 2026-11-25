// Rebuilds src/provider-catalog.json from models.dev (github.com/sst/models.dev, README
// "API" section: provider `npm`, `api`, `doc`; model `tool_call`, `attachment`,
// `reasoning_options`, `limit`, `modalities`, `status`). Run after changing ALLOW, or to
// pick up new models:
//   cd packages/shared && bun scripts/sync-providers.ts
// Only providers whose `npm` package has an adapter in apps/ai-agent/agent/lib/providers.ts
// (read from that package's AI SDK docs) may be listed; the script refuses any other.
import {
	ADAPTED_NPM,
	type Catalog,
	EFFORTS,
	type Kind,
} from "../src/providers";

// Hosted providers, by models.dev id. Not here on purpose: Databricks (its URL is any
// host the user names: use a custom endpoint), local servers (LM Studio), subscription
// "coding plans", and models.dev's "perplexity" (old Sonar ids, no tool calling).
// "perplexity-agent" is Perplexity's Agent API through its OpenAI Responses alias
// (docs.perplexity.ai/docs/agent-api/openai-compatibility), which calls tools.
const ALLOW = [
	"openai",
	"anthropic",
	"google",
	"xai",
	"mistral",
	"deepseek",
	"openrouter",
	"groq",
	"cerebras",
	"togetherai",
	"fireworks-ai",
	"deepinfra",
	"cohere",
	"moonshotai",
	"alibaba",
	"zai",
	"minimax",
	"huggingface",
	"nvidia",
	"sambanova",
	"nebius",
	"ovhcloud",
	"baseten",
	"friendli",
	"crusoe",
	"inception",
	"liquid",
	"ai21",
	"upstage",
	"sarvam",
	"stepfun",
	"siliconflow",
	"novita-ai",
	"chutes",
	"scaleway",
	"vultr",
	"digitalocean",
	"helicone",
	"requesty",
	"aimlapi",
	"gmicloud",
	"ollama-cloud",
	"arcee",
	"volcengine",
	"byteplus",
	"xiaomi",
	"tencent-tokenhub",
	"wandb",
	"hetzner",
	"berget",
	"perplexity-agent",
	"amazon-bedrock",
	"google-vertex",
	"azure",
	"cloudflare-workers-ai",
	"snowflake-cortex",
	"infomaniak",
];

const KINDS: Record<string, Kind> = {
	"@ai-sdk/amazon-bedrock": "bedrock",
	"@ai-sdk/google-vertex": "vertex",
	"@ai-sdk/azure": "azure",
};

type Source = Record<
	string,
	{
		name: string;
		npm?: string;
		api?: string;
		doc?: string;
		env?: string[];
		models: Record<
			string,
			{
				id: string;
				name: string;
				tool_call?: boolean;
				attachment?: boolean;
				status?: string;
				reasoning_options?: { type: string; values?: string[] }[];
				limit?: { context?: number; input?: number };
				modalities?: { input?: string[]; output?: string[] };
				/** A different package, URL or API for this model. */
				provider?: { npm?: string; api?: string; shape?: string };
			}
		>;
	}
>;

const res = await fetch("https://models.dev/api.json");
if (!res.ok) throw new Error(`models.dev: ${res.status}`);
const src = (await res.json()) as Source;

const catalog: Catalog = [];
for (const id of ALLOW) {
	const p = src[id];
	if (!p) throw new Error(`models.dev has no provider "${id}"`);
	if (!p.npm || !ADAPTED_NPM.includes(p.npm))
		throw new Error(`${id}: no adapter for ${p.npm}`);
	const vars = [...(p.api ?? "").matchAll(/\$\{(\w+)\}/g)].map((m) => m[1]);
	const kind: Kind = KINDS[p.npm] ?? (vars.length ? "template" : "key");
	// One key, plus the URL's values for templates (Google lists three names for one key).
	if (
		(kind === "key" || kind === "template") &&
		id !== "google" &&
		(p.env ?? []).filter((e) => !vars.includes(e)).length !== 1
	)
		throw new Error(`${id}: needs more than one credential (${p.env})`);
	if (p.api && !p.api.startsWith("https://"))
		throw new Error(`${id}: base URL is not https (${p.api})`);
	const models = Object.values(p.models)
		.filter(
			(m) =>
				m.tool_call && // eve agents call tools on most turns
				m.status !== "deprecated" &&
				(m.modalities?.output ?? ["text"]).includes("text") &&
				(m.limit?.context ?? 0) > 0 &&
				// A model on another package or API shape needs its own adapter: left out.
				// A plain https URL of its own is kept (stored as the model's `api`).
				(!m.provider ||
					(!m.provider.npm &&
						!m.provider.shape &&
						/^https:\/\/[^$]+$/.test(m.provider.api ?? ""))),
		)
		.map((m) => {
			const window = Math.min(
				m.limit?.context ?? Number.POSITIVE_INFINITY,
				m.limit?.input ?? Number.POSITIVE_INFINITY,
			);
			const efforts = (
				m.reasoning_options?.find((o) => o.type === "effort")?.values ?? []
			).filter((e): e is (typeof EFFORTS)[number] =>
				(EFFORTS as readonly string[]).includes(e),
			);
			const input = m.modalities?.input ?? [];
			return {
				id: m.id,
				name: m.name,
				contextWindow: window,
				...(input.includes("image") ? {} : { vision: false }),
				...(input.includes("pdf") ? {} : { pdf: false }),
				...(efforts.length ? { efforts } : {}),
				...(m.provider?.api ? { api: m.provider.api } : {}),
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));
	// Azure models are the user's deployment names, not this list.
	if (!models.length && kind !== "azure")
		throw new Error(`${id}: no tool-calling models`);
	catalog.push({
		id,
		name: p.name,
		npm: p.npm,
		kind,
		...(p.api ? { api: p.api } : {}),
		...(vars.length ? { vars } : {}),
		...(p.doc ? { doc: p.doc } : {}),
		models: kind === "azure" ? [] : models,
	});
}

await Bun.write(
	new URL("../src/provider-catalog.json", import.meta.url),
	`${JSON.stringify(catalog, null, "\t")}\n`,
);
console.log(
	`${catalog.length} providers, ${catalog.reduce((n, p) => n + p.models.length, 0)} models`,
);
