import assert from "node:assert/strict";
import { graphSchema } from "../workflows/graph/schema";
import { blocksRun, dataChanges } from "./test-scope";

// Manual → Gmail (read) → Sheets (appends a row) → HTTP POST. A test that includes the write is asked about first.
const at = { x: 0, y: 0 };
const g = graphSchema.parse({
  nodes: [
    { id: "t", kind: "trigger.manual", position: at, config: {} },
    { id: "mail", kind: "action.app", position: at, config: { toolkit: "gmail", tool: "GMAIL_FETCH_EMAILS" } },
    { id: "sheet", kind: "action.app", position: at, label: "Add row", config: { toolkit: "googlesheets", tool: "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND" } },
    { id: "hook", kind: "action.http", position: at, config: { method: "POST", url: "https://example.com/notify" } },
  ],
  edges: [
    { id: "e1", source: "t", target: "mail" },
    { id: "e2", source: "mail", target: "sheet" },
    { id: "e3", source: "sheet", target: "hook" },
  ],
});
const read = (_toolkit: string, tool: string) => tool.includes("FETCH");

assert.deepEqual(dataChanges(blocksRun(g), read), ["Add row (GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND)", "hook (POST https://example.com/notify)"]);
// Testing only up to the Gmail step reads only: no question needed.
assert.deepEqual(dataChanges(blocksRun(g, "mail"), read), []);
assert.deepEqual(blocksRun(g, "sheet").map((n) => n.id), ["t", "mail", "sheet"]);
// A pinned block uses its sample, so it changes nothing.
assert.deepEqual(dataChanges(blocksRun({ ...g, pins: { sheet: {} } }), read), ["hook (POST https://example.com/notify)"]);

console.log("assistant test scope: ok");
