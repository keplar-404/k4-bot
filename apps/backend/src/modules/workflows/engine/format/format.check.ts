// bun run src/modules/workflows/engine/format/format.check.ts
import assert from "node:assert/strict";
import { formatConfig } from "../../graph/format-block";
import { runFormat } from "./index";

const ctx = { trigger: { body: { text: "  Hello   WORLD, mail ada@example.com see https://x.io/a?b=1 now ", n: "3.14159", tags: ["a", "b", "a"], when: "2026-01-31T23:30:00Z" } }, steps: {}, run: { id: "r", startedAt: "" } };
const f = (operation: string, input: string, options: Record<string, string> = {}) =>
  runFormat(formatConfig.parse({ operation, input, options }), ctx).result;

assert.equal(String(f("trim", "{{trigger.body.text}}")).startsWith("Hello WORLD,"), true);
assert.equal(f("capitalize", "hello big world"), "Hello Big World");
assert.equal(f("extract_email", "{{trigger.body.text}}"), "ada@example.com");
assert.equal(f("extract_url", "{{trigger.body.text}}"), "https://x.io/a?b=1");
assert.equal(f("extract_number", "Total: 12,50 EUR"), 12.5);
assert.equal(f("replace", "a-b-c", { find: "-", replace: "+" }), "a+b+c");
assert.equal(f("replace", "(a+)+$", { find: "(a+)+", replace: "x" }), "x$", "find is plain text, not a pattern");
assert.deepEqual(f("split", "a, b,,c"), ["a", "b", "c"]);
assert.equal(f("truncate", "abcdefgh", { length: "3" }), "abc…");
assert.equal(f("round", "{{trigger.body.n}}", { decimals: "2" }), 3.14);
assert.equal(f("multiply", "4", { value: "2.5" }), 10);
assert.equal(f("divide", "4", { value: "0" }), null, "no division by zero");
assert.equal(f("add", "not a number", { value: "1" }), null);
assert.equal(f("add_time", "{{trigger.body.when}}", { amount: "1", unit: "hours" }), "2026-02-01T00:30:00.000Z");
assert.equal(f("format_date", "2026-01-31T23:30:00Z", { timezone: "Asia/Dhaka", dateStyle: "medium" }), "Feb 1, 2026");
assert.equal(f("to_timezone", "{{trigger.body.when}}", { timezone: "Mars/Base" }), null, "a bad zone is null, not a crash");
assert.equal(f("join", "{{trigger.body.tags}}", { separator: "|" }), "a|b|a");
assert.deepEqual(f("unique", "{{trigger.body.tags}}"), ["a", "b"]);
assert.equal(f("count", "{{trigger.body.tags}}"), 3);
assert.equal(f("first", '["x","y"]'), "x");
console.log("formatter: all checks passed");
