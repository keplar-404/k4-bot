import assert from "node:assert/strict";
import { botUnixUser, checkKeys, checkTypedText, checkUrl, looksLikeSecret, shellQuote } from "./guards";
import { computerActionSchema } from "./types";

// URLs: public web only.
const ok = (u: string, allow: string[] = []) => checkUrl(u, allow).ok;
assert.ok(ok("https://example.com/path?q=1"));
assert.ok(ok("http://sub.example.co.uk"));
for (const bad of [
  "file:///etc/passwd",
  "javascript:alert(1)",
  "chrome://settings",
  "ftp://example.com",
  "http://localhost:3000",
  "http://127.0.0.1",
  "http://2130706433", // decimal form of 127.0.0.1
  "http://0x7f.1", // hex form
  "http://169.254.169.254/latest/meta-data", // cloud metadata
  "http://10.0.0.5",
  "http://192.168.1.1",
  "http://172.16.0.1",
  "http://100.64.0.1",
  "http://[::1]/",
  "http://metadata.google.internal",
  "http://router.local",
  "http://intranet",
  "https://user:pass@example.com",
  "not a url",
]) {
  assert.equal(ok(bad), false, `must reject ${bad}`);
}
// The allow-list, when set, wins over "any public host".
assert.ok(ok("https://docs.example.com", ["example.com"]));
assert.equal(ok("https://evil.com", ["example.com"]), false);
assert.equal(ok("https://notexample.com", ["example.com"]), false, "suffix match must respect the dot");

// Keys: names only, never shell syntax.
assert.deepEqual(checkKeys("ctrl+l"), { ok: true, value: ["ctrl+l"] });
assert.ok(checkKeys("Return").ok && checkKeys("alt+Left").ok && checkKeys("ctrl+a ctrl+c").ok);
for (const bad of ["a; rm -rf /", "$(id)", "`id`", "a|b", "a&&b", "a>b", "x".repeat(41), "a b c d e f g h i"]) {
  assert.equal(checkKeys(bad).ok, false, `must reject key input ${JSON.stringify(bad)}`);
}

// Typed text: secrets and cards are refused, ordinary text is not.
assert.ok(checkTypedText("Hello, my order number is 12345").ok);
assert.ok(checkTypedText("Call me at 555 123 4567").ok, "a phone number is not a card");
assert.equal(looksLikeSecret("4111 1111 1111 1111"), true, "valid test card");
assert.equal(looksLikeSecret("4111-1111-1111-1111"), true);
assert.equal(looksLikeSecret("4111 1111 1111 1112"), false, "fails Luhn");
assert.equal(looksLikeSecret("sk-or-v1-abcdefghijklmnopqrstuvwxyz0123456789"), true);
assert.equal(looksLikeSecret("AKIAIOSFODNN7EXAMPLE"), true);
assert.equal(looksLikeSecret("-----BEGIN RSA PRIVATE KEY-----"), true);
assert.equal(checkTypedText("a\0b").ok, false);

// Shell quoting survives hostile input.
assert.equal(shellQuote("it's"), `'it'"'"'s'`);
assert.equal(shellQuote("$(id); `id`"), "'$(id); `id`'");

// One Linux user per bot, derived only from a UUID.
const id = "123e4567-e89b-42d3-a456-426614174000";
assert.deepEqual(botUnixUser(id), { ok: true, value: "u_123e4567e89b42d3a4564266" });
const user = botUnixUser(id);
assert.ok(user.ok && user.value.length === 26);
for (const bad of ["root", "../etc", "a b", "", "123e4567-e89b-42d3-a456-42661417400g"]) {
  assert.equal(botUnixUser(bad).ok, false, `must reject bot id ${JSON.stringify(bad)}`);
}

// Action schema: coordinates stay on screen, unknown actions are rejected.
assert.ok(computerActionSchema.safeParse({ action: "left_click", x: 10, y: 10 }).success);
assert.equal(computerActionSchema.safeParse({ action: "left_click", x: 1280, y: 10 }).success, false);
assert.equal(computerActionSchema.safeParse({ action: "left_click", x: -1, y: 10 }).success, false);
assert.equal(computerActionSchema.safeParse({ action: "left_click", x: 1.5, y: 10 }).success, false);
assert.equal(computerActionSchema.safeParse({ action: "rm_rf" }).success, false);
assert.equal(computerActionSchema.safeParse({ action: "scroll", direction: "down", amount: 500 }).success, false);
assert.equal(computerActionSchema.safeParse({ action: "wait", seconds: 9999 }).success, false);
assert.equal(computerActionSchema.safeParse({ action: "type", text: "x".repeat(2001) }).success, false);

console.log("computer guards: all checks passed");
