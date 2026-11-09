// bun run src/modules/workflows/routes/hook-auth.check.ts
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { hmacHex, ipAllowed } from "./hook-auth";

assert.ok(ipAllowed("1.2.3.4", []), "an empty list allows everyone");
assert.ok(ipAllowed("203.0.113.9", ["203.0.113.0/24"]));
assert.ok(!ipAllowed("203.0.114.9", ["203.0.113.0/24"]));
assert.ok(ipAllowed("10.0.0.1", ["10.0.0.1"]));
assert.ok(!ipAllowed("10.0.0.2", ["10.0.0.1"]));
assert.ok(ipAllowed("2001:db8::1", ["2001:DB8::1"]), "IPv6 exact, case-insensitive");
assert.ok(!ipAllowed("not-an-ip", ["0.0.0.0/0"]));
assert.ok(ipAllowed("8.8.8.8", ["0.0.0.0/0"]));
const body = '{"event":"paid"}';
assert.equal(await hmacHex("whsec_test", body), createHmac("sha256", "whsec_test").update(body).digest("hex"));
console.log("hook auth: all checks passed");
