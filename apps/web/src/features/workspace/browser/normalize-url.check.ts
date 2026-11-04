import assert from "node:assert/strict";
import { normalizeUrl } from "./normalize-url";

assert.equal(normalizeUrl("example.com").url, "https://example.com/");
assert.equal(
  normalizeUrl("  https://example.com/a?b=1 ").url,
  "https://example.com/a?b=1",
);
for (const bad of [
  "javascript:alert(1)",
  "data:text/html,hi",
  "file:///etc/passwd",
  "http://127.0.0.1",
  "http://localhost:3000",
  "http://app.localhost",
  "http://10.0.0.1",
  "http://172.20.1.1",
  "http://192.168.1.1",
  "http://169.254.169.254/latest/meta-data",
  "http://0.0.0.0",
  "http://[::1]/",
  "http://[fd00::1]/",
  "",
]) {
  assert.ok(normalizeUrl(bad).error, `${bad || "(empty)"} must be refused`);
}
assert.equal(
  normalizeUrl("http://172.32.0.1").error,
  undefined,
  "172.32 is public",
);
console.log("normalize-url: all checks passed");
