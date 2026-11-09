import assert from "node:assert/strict";
import { delayConfig } from "../graph/blocks";
import { delayMs } from "./delay";

const ctx = { trigger: { when: "2026-01-05T12:00:00Z" }, steps: {}, run: { id: "r", startedAt: "" } };
const now = Date.parse("2026-01-05T10:00:00Z"); // a Monday
const d = (o: object) => delayConfig.parse(o);

assert.deepEqual(delayMs(d({ amount: 2, unit: "hours" }), ctx, now), { ms: 7_200_000 });
assert.deepEqual(delayMs(d({ mode: "until", until: "{{trigger.when}}" }), ctx, now), { ms: 7_200_000 });
assert.deepEqual(delayMs(d({ mode: "until", until: "2025-01-01T00:00:00Z" }), ctx, now), { ms: 0 }, "past: go on at once");
assert.ok("error" in delayMs(d({ mode: "until", until: "soon" }), ctx, now));
assert.ok("error" in delayMs(d({ mode: "until", until: "2026-03-01T00:00:00Z" }), ctx, now), "more than 7 days ahead");
// Next Wednesday 09:00 UTC from Monday 10:00 = 1 day 23 h.
assert.deepEqual(delayMs(d({ mode: "next", days: [3], at: "09:00", timezone: "UTC" }), ctx, now), { ms: (47 * 3600) * 1000 });
console.log("delay: all checks passed");
