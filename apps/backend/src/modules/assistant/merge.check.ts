import assert from "node:assert/strict";
import { mergeSettings } from "./merge";

// Changing one nested setting keeps its siblings (the old shallow merge replaced the whole `arguments` object).
const current = { toolkit: "gmail", tool: "GMAIL_FETCH_EMAILS", arguments: { verbose: false, max_results: "5", label_ids: ["INBOX"] } };
const next = mergeSettings(current, { arguments: { max_results: 10, label_ids: ["UNREAD"] } });
assert.deepEqual(next, { toolkit: "gmail", tool: "GMAIL_FETCH_EMAILS", arguments: { verbose: false, max_results: 10, label_ids: ["UNREAD"] } });
assert.equal(current.arguments.max_results, "5", "the input is not changed");
assert.deepEqual(mergeSettings(undefined, { a: 1 }), { a: 1 });

// A patch cannot reach into the prototype.
const evil = JSON.parse('{"__proto__": {"polluted": true}, "ok": 1}');
const merged = mergeSettings({}, evil);
assert.equal(({} as Record<string, unknown>).polluted, undefined);
assert.equal(merged.ok, 1);

console.log("assistant merge: ok");
