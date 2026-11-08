import assert from "node:assert/strict";
import { checkOutboundUrl, deniedHeader } from "./http-guard";

const prod = { BETTER_AUTH_URL: "https://api.example.com", WEB_ORIGIN: "https://app.example.com" };
const dev = { BETTER_AUTH_URL: "http://localhost:8787", WEB_ORIGIN: "http://localhost:3000" };

for (const url of [
  "http://169.254.169.254/latest/meta-data",
  "https://127.0.0.1/",
  "https://2130706433/",
  "https://[::1]/",
  "https://[::ffff:127.0.0.1]/",
  "https://metadata.google.internal/",
  "https://printer.local/",
  "https://100.64.0.1/",
  "https://user:pw@example.org/",
  "https://api.example.com/api/v1/hooks",
  "https://app.example.com/",
  "http://example.org/",
  "ftp://example.org/",
  "not a url",
])
  assert.ok(checkOutboundUrl(url, prod), `must refuse ${url}`);

assert.equal(checkOutboundUrl("https://httpbin.org/json", prod), null, "a public https site is allowed");
assert.equal(checkOutboundUrl("http://example.org/", dev), null, "plain http is only for local dev");
assert.ok(checkOutboundUrl("http://localhost:8787/api", dev), "even in dev the app's own host is refused");
for (const h of ["Host", "cookie", "Content-Length", "x-k4-workflow-run", "Transfer-Encoding"])
  assert.ok(deniedHeader(h), h);
assert.ok(!deniedHeader("authorization") && !deniedHeader("x-api-key"));
console.log("http-guard: all checks passed");
