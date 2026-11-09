import assert from "node:assert/strict";
import { FatalBlockError } from "../errors";
import { runHttp } from "./http-pages";

type Config = Parameters<typeof runHttp>[3];

const env = {
  RL_HTTP: { limit: async () => ({ success: true }) },
  BETTER_AUTH_URL: "https://api.example.com",
  WEB_ORIGIN: "https://app.example.com",
} as never;
const base: Config = {
  method: "GET",
  url: "https://example.org/a",
  query: [],
  auth: { type: "none", token: "", username: "", headerName: "X-API-Key" },
  pagination: { mode: "none", param: "page", start: 1, itemsPath: "", nextPath: "", maxPages: 5 },
  headers: [],
  body: { type: "none", value: "" },
  timeoutSeconds: 5,
  expect: "json",
};

const requested: string[] = [];
function serve(handler: (url: string, init?: RequestInit) => Response) {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    requested.push(String(url));
    return handler(String(url), init);
  }) as never;
}
async function expectFailure(run: Promise<unknown>, fatal: boolean, message: RegExp) {
  const error = await run.then(
    () => null,
    (e: Error) => e,
  );
  assert.ok(error && message.test(error.message), `expected ${message}, got ${error?.message}`);
  assert.equal(error instanceof FatalBlockError, fatal);
}
const redirectTo = (location: string) => new Response(null, { status: 302, headers: { location } });

// A redirect to a private address is refused on that hop, before it is requested.
serve((url) => (url.includes("example.org") ? redirectTo("http://169.254.169.254/latest") : new Response("secret")));
await expectFailure(runHttp(env, "u", "r", base), true, /Private|Only https/);
assert.deepEqual(requested, ["https://example.org/a"], "the metadata address was never requested");

// Credentials do not follow a redirect to another site.
let authorization: string | null = "unset";
serve((url, init) => {
  if (url.includes("example.org")) return redirectTo("https://other.example.net/b");
  authorization = new Headers(init?.headers).get("authorization");
  return new Response('{"ok":true}');
});
const withAuth = { ...base, headers: [{ name: "Authorization", value: "Bearer abcdef123456" }] };
const ok = (await runHttp(env, "u", "r", withAuth)) as { body: unknown };
assert.deepEqual(ok.body, { ok: true });
assert.equal(authorization, null, "authorization dropped on a cross-site redirect");

// Redirect loops end. 4xx is fatal except 408/429; 5xx and 429 may be retried.
serve(() => redirectTo("https://example.org/a"));
await expectFailure(runHttp(env, "u", "r", base), true, /Too many redirects/);
serve(() => new Response("no", { status: 404 }));
await expectFailure(runHttp(env, "u", "r", base), true, /404/);
serve(() => new Response("slow down", { status: 429 }));
await expectFailure(runHttp(env, "u", "r", base), false, /429/);
serve(() => new Response("oops", { status: 503 }));
await expectFailure(runHttp(env, "u", "r", base), false, /503/);

// A huge body is cut at 1 MB, and the result says so.
serve(() => new Response("x".repeat(3 * 1024 * 1024)));
const big = (await runHttp(env, "u", "r", { ...base, expect: "text" })) as {
  body: string;
  truncated?: boolean;
};
assert.ok(big.truncated && big.body.length === 1024 * 1024, "cut at 1 MB and said so");

// Blocked headers and broken JSON fail at once.
const withCookie = { ...base, headers: [{ name: "Cookie", value: "a=b" }] };
await expectFailure(runHttp(env, "u", "r", withCookie), true, /cannot be set/);
const brokenJson: Config = { ...base, method: "POST", body: { type: "json", value: "{oops" } };
await expectFailure(runHttp(env, "u", "r", brokenJson), true, /not valid JSON/);

// Query parameters are encoded onto the URL; sign-in presets set their header.
let seen: Headers | undefined;
serve((_url, init) => {
  seen = new Headers(init?.headers);
  return new Response("{}");
});
requested.length = 0;
await runHttp(env, "u", "r", { ...base, query: [{ name: "q", value: "a b&c" }], auth: { ...base.auth, type: "bearer", token: "tok" } });
assert.equal(requested[0], "https://example.org/a?q=a+b%26c");
assert.equal(seen?.get("authorization"), "Bearer tok");
await runHttp(env, "u", "r", { ...base, auth: { ...base.auth, type: "basic", username: "ann", token: "pw" } });
assert.equal(seen?.get("authorization"), `Basic ${btoa("ann:pw")}`);
await runHttp(env, "u", "r", { ...base, auth: { ...base.auth, type: "api_key", headerName: "X-Key", token: "k" } });
assert.equal(seen?.get("x-key"), "k");
await expectFailure(runHttp(env, "u", "r", { ...base, auth: { ...base.auth, type: "bearer" } }), true, /token is empty/);

// Pagination: page numbers until an empty page; a cursor; a next URL. Items are collected.
const pg = (o: Partial<Config["pagination"]>) => ({ ...base, pagination: { ...base.pagination, ...o } });
serve((url) => {
  const page = Number(new URL(url).searchParams.get("p") ?? 0);
  return Response.json({ rows: page < 3 ? [page] : [] });
});
const paged = (await runHttp(env, "u", "r", pg({ mode: "page", param: "p", start: 1, itemsPath: "rows" }))) as { items: unknown[]; pages: number };
assert.deepEqual([paged.items, paged.pages], [[1, 2], 3]);
serve((url) => {
  const c = new URL(url).searchParams.get("c");
  return Response.json(c ? { data: ["b"], next: null } : { data: ["a"], next: "x" });
});
assert.deepEqual(((await runHttp(env, "u", "r", pg({ mode: "cursor", param: "c", itemsPath: "data", nextPath: "next" }))) as { items: unknown[] }).items, ["a", "b"]);
serve((url) => Response.json(url.endsWith("/a") ? { list: [1], links: { next: "/b" } } : { list: [2], links: {} }));
assert.deepEqual(((await runHttp(env, "u", "r", pg({ mode: "next_url", itemsPath: "list", nextPath: "links.next", maxPages: 2 }))) as { items: unknown[] }).items, [1, 2]);

console.log("http block: all checks passed");
