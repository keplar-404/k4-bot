import { expect, test } from "bun:test";
import { defaultModelId } from "./models";
import {
	ADAPTED_NPM,
	catalog,
	checkCredentials,
	decryptKey,
	EFFORTS,
	encryptKey,
	fillUrl,
	findProvider,
	modelRef,
	parseRef,
	resolveModel,
} from "./providers";

process.env.PROVIDER_KEY_SECRET = Buffer.alloc(32, 7).toString("base64");

test("a key decrypts only for the same user and provider", () => {
	const sealed = encryptKey("u1", "openai", "sk-test-123");
	expect(sealed).not.toContain("sk-test");
	expect(decryptKey("u1", "openai", sealed)).toBe("sk-test-123");
	expect(() => decryptKey("u2", "openai", sealed)).toThrow();
	expect(() => decryptKey("u1", "anthropic", sealed)).toThrow();
	// Two encryptions of the same key differ (fresh IV).
	expect(encryptKey("u1", "openai", "k")).not.toBe(
		encryptKey("u1", "openai", "k"),
	);
});

test("refs resolve only to catalog models", () => {
	const p = catalog[0];
	const m = p.models[0];
	const hit = parseRef(modelRef(p.id, m.id));
	expect(hit?.model.id).toBe(m.id);
	expect(parseRef(modelRef(p.id, "not-a-model"))).toBeNull();
	expect(parseRef("byok:nope/x")).toBeNull();
	expect(parseRef("anthropic/claude-sonnet-5.5")).toBeNull();
	// Unknown refs fall back to the free built-in model, like findModel.
	expect(resolveModel("byok:nope/x").id).toBe(defaultModelId);
	expect(resolveModel(modelRef(p.id, m.id)).contextWindow).toBe(
		m.contextWindow,
	);
});

// The agent can only build providers it has an adapter for, and eve rejects other efforts.
test("the catalog only uses adapted packages and eve's efforts", () => {
	expect(catalog.length).toBeGreaterThan(0);
	for (const p of catalog) {
		expect(ADAPTED_NPM).toContain(p.npm);
		if (p.npm === "@ai-sdk/openai-compatible")
			expect(p.api).toStartWith("https://");
		for (const m of p.models) {
			expect(m.contextWindow).toBeGreaterThan(0);
			for (const e of m.efforts ?? []) expect(EFFORTS).toContain(e);
		}
	}
});

const byId = (id: string) => {
	const p = findProvider(id);
	if (!p) throw new Error(id);
	return p;
};

test("a key form keeps the key secret and shows only 4 characters", () => {
	const r = checkCredentials(byId("openai"), { apiKey: " sk-abcdefgh1234 " });
	expect(r).toEqual({
		secret: { apiKey: "sk-abcdefgh1234" },
		config: {},
		hint: "…1234",
	});
	expect(
		checkCredentials(byId("openai"), { apiKey: "has space in it" }),
	).toHaveProperty("error");
	expect(checkCredentials(byId("openai"), {})).toHaveProperty("error");
});

test("vertex takes only a service account's email and key", () => {
	const sa = {
		type: "service_account",
		project_id: "my-project-1",
		client_email: "bot@my-project-1.iam.gserviceaccount.com",
		private_key:
			"-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
		private_key_id: "dropped",
	};
	const r = checkCredentials(byId("google-vertex"), {
		serviceAccount: JSON.stringify(sa),
		location: "us-central1",
	});
	if ("error" in r) throw new Error(r.error);
	expect(Object.keys(r.secret).sort()).toEqual(["client_email", "private_key"]);
	expect(r.config).toEqual({
		location: "us-central1",
		project: "my-project-1",
	});
	// An external-account file would make Google's library read files or call URLs.
	const ext = {
		type: "external_account",
		credential_source: { file: "/etc/passwd" },
	};
	expect(
		checkCredentials(byId("google-vertex"), {
			serviceAccount: JSON.stringify(ext),
			location: "us-central1",
			project: "my-project-1",
		}),
	).toHaveProperty("error");
});

test("custom endpoints must be public https, and template values can't move the URL", () => {
	const custom = byId("custom-mine");
	const ok = {
		name: "mine",
		baseURL: "https://api.example.com/v1",
		models: "a, b, a",
		contextWindow: "64000",
	};
	const r = checkCredentials(custom, ok);
	if ("error" in r) throw new Error(r.error);
	expect(r.config.models).toEqual(["a", "b"]);
	for (const baseURL of [
		"http://api.example.com",
		"https://127.0.0.1/v1",
		"https://localhost/v1",
		"https://metadata.google.internal/",
		"https://user:pw@api.example.com/",
		"https://api.example.com/?key=x",
	])
		expect(checkCredentials(custom, { ...ok, baseURL })).toHaveProperty(
			"error",
		);
	const cf = byId("cloudflare-workers-ai");
	expect(
		checkCredentials(cf, {
			CLOUDFLARE_ACCOUNT_ID: "evil.com/x?",
			apiKey: "k".repeat(20),
		}),
	).toHaveProperty("error");
	expect(fillUrl(cf.api ?? "", { CLOUDFLARE_ACCOUNT_ID: "abc123" })).toBe(
		"https://api.cloudflare.com/client/v4/accounts/abc123/ai/v1",
	);
});

test("user-named models resolve as text-only, pdf-less options", () => {
	const o = resolveModel("byok:custom-mine/llama-4");
	expect(o.id).toBe("byok:custom-mine/llama-4");
	expect(o.vision).toBe(false);
	expect(o.pdf).toBe(false);
});

test("after a rotation the previous master key still opens old rows", () => {
	const old = process.env.PROVIDER_KEY_SECRET;
	const sealed = encryptKey("u1", "openai", "sk-old");
	process.env.PROVIDER_KEY_SECRET = Buffer.alloc(32, 9).toString("base64");
	expect(() => decryptKey("u1", "openai", sealed)).toThrow();
	process.env.PROVIDER_KEY_SECRET_PREVIOUS = old;
	expect(decryptKey("u1", "openai", sealed)).toBe("sk-old");
	process.env.PROVIDER_KEY_SECRET = old;
	delete process.env.PROVIDER_KEY_SECRET_PREVIOUS;
});
