import assert from "node:assert/strict";
import { FatalBlockError } from "../errors";
import { runHttp } from "./http";

type Config = Parameters<typeof runHttp>[3];

const env = {
  RL_HTTP: { limit: async () => ({ success: true }) },
  BETTER_AUTH_URL: "https://api.example.com",
  WEB_ORIGIN: "https://app.example.com",
} as never;
const base: Config = {
  method: "GET",
  url: "https://example.org/a",
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

console.log("http block: all checks passed");
