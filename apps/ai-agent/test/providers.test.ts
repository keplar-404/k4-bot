import { expect, test } from "bun:test";
import { CUSTOM, catalog } from "@repo/shared/providers";
import {
	isPublicHost,
	publicFetch,
	publicLookup,
	userModel,
} from "../agent/lib/providers";

const creds = {
	secret: {
		apiKey: "test-key-1234",
		accessKeyId: "AKIATEST",
		secretAccessKey: "secret-test",
		client_email: "x@p.iam.gserviceaccount.com",
		private_key: "-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n",
	},
	config: {
		region: "us-east-1",
		project: "my-project",
		location: "us-central1",
		resourceName: "my-resource",
		CLOUDFLARE_ACCOUNT_ID: "abc123",
		SNOWFLAKE_ACCOUNT: "org-acct",
		INFOMANIAK_PRODUCT_ID: "123",
		baseURL: "https://api.example.com/v1",
	},
};

// One provider per package and kind: each adapter builds a model without the network.
test("every adapter builds a model", async () => {
	const seen = new Set<string>();
	for (const p of [...catalog, { ...CUSTOM, id: "custom-x" }]) {
		if (seen.has(`${p.npm} ${p.kind}`)) continue;
		seen.add(`${p.npm} ${p.kind}`);
		const m = p.models[0] ?? {
			id: "my-deployment",
			name: "x",
			contextWindow: 1,
		};
		const built = await userModel(p, m, creds);
		expect(
			typeof built === "object" && built && "modelId" in built && built.modelId,
		).toBe(m.id);
	}
	expect(seen.size).toBeGreaterThan(15);
});

test("a missing credential fails instead of using the server's env", async () => {
	const p = catalog.find((x) => x.id === "openai");
	if (!p) throw new Error("no openai");
	await expect(
		userModel(p, p.models[0], { secret: {}, config: {} }),
	).rejects.toThrow();
});

test("custom endpoints can't reach private addresses", async () => {
	for (const host of [
		"127.0.0.1",
		"10.1.2.3",
		"169.254.169.254",
		"[::1]",
		"192.168.1.1",
		"localhost",
	])
		expect(await isPublicHost(host)).toBe(false);
	expect(await isPublicHost("8.8.8.8")).toBe(true);
	await expect(publicFetch("http://example.com/")).rejects.toThrow();
	await expect(publicFetch("https://127.0.0.1/v1")).rejects.toThrow();
});

test("the socket's own lookup refuses private answers", async () => {
	const ask = (host: string, all: boolean) =>
		new Promise((resolve, reject) =>
			publicLookup(host, { all }, (err, a) => (err ? reject(err) : resolve(a))),
		);
	await expect(ask("localhost", false)).rejects.toThrow("not a public");
	await expect(ask("localhost", true)).rejects.toThrow("not a public");
	expect(await ask("8.8.8.8", false)).toBe("8.8.8.8");
	expect(await ask("8.8.8.8", true)).toEqual([
		{ address: "8.8.8.8", family: 4 },
	]);
});
