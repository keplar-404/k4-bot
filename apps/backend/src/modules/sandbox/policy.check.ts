import assert from "node:assert/strict";
import { addUsage, clampTimeout, replaceOnce, shellQuote, shouldPause } from "./policy";

const idle = { working: false, editorOpen: false, idleMs: 11 * 60_000, limitMs: 10 * 60_000 };
assert.equal(shouldPause(idle), true, "idle past the limit with nobody using it sleeps");
assert.equal(shouldPause({ ...idle, working: true }), false, "a working bot keeps it awake");
assert.equal(shouldPause({ ...idle, editorOpen: true }), false, "an open editor keeps it awake");
assert.equal(shouldPause({ ...idle, idleMs: 60_000 }), false, "recently used stays awake");

assert.equal(shellQuote("a b"), "'a b'");
assert.equal(shellQuote("$(rm -rf /)"), "'$(rm -rf /)'", "no expansion inside single quotes");
assert.equal(shellQuote("it's"), `'it'\\''s'`);

assert.equal(clampTimeout(undefined), 120);
assert.equal(clampTimeout(5000), 600);
assert.equal(clampTimeout(0), 1);

const t = Date.UTC(2026, 10, 4, 12);
assert.deepEqual(addUsage(null, t - 30_000, t, 30_000), { day: "2026-11-04", seconds: 30 });
assert.deepEqual(addUsage({ day: "2026-11-04", seconds: 30 }, t - 3_600_000, t, 30_000), { day: "2026-11-04", seconds: 90 }, "a missed alarm bills at most two ticks");
assert.deepEqual(addUsage({ day: "2026-11-03", seconds: 999 }, t - 30_000, t, 30_000), { day: "2026-11-04", seconds: 30 }, "new day restarts");

assert.deepEqual(replaceOnce("a\nb\nc", "b", "B"), { ok: true, content: "a\nB\nc" }, "the file keeps no line numbers");
assert.equal(replaceOnce("x x", "x", "y").ok, false, "ambiguous edit refused");
assert.equal(replaceOnce("abc", "z", "y").ok, false, "missing text refused");
assert.deepEqual(replaceOnce("a$&b", "$&", "Q"), { ok: true, content: "aQb" }, "no replace() pattern surprises");

console.log("sandbox policy: all checks passed");
