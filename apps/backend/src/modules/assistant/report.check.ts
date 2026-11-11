import assert from "node:assert/strict";
import { pathsOf } from "./fields";
import { referenceProblems, runReport } from "./report";

// The run from the screenshot: Gmail returned `messages`, but For each was told to read `preview.messages`.
const gmailOut = { messages: [{ subject: "Hi", preview: { body: "x" }, to: null }], nextPageToken: "t", resultSizeEstimate: 201 };
const loopConfig = { items: "{{steps.gmail_fetch.output.preview.messages}}", max: 10 };
const run = {
  id: "r1",
  status: "failed",
  failedNodeId: "loop",
  error: "Step failed",
  steps: [
    { nodeId: "trigger", nodeKind: "trigger.manual", status: "succeeded", input: {}, output: { inputs: {} } },
    { nodeId: "gmail_fetch", nodeKind: "action.app", status: "succeeded", input: { max_results: 10 }, output: gmailOut },
    { nodeId: "loop", nodeKind: "logic.loop", status: "failed", error: "For each needs a list.", input: loopConfig },
  ],
};
const report = runReport(run, { nameOf: (id) => (id === "loop" ? "For each email" : id), configOf: (id) => (id === "loop" ? loopConfig : undefined) });

// WHERE and WHY
assert.equal(report.failedAt?.block, "loop");
assert.equal(report.failedAt?.name, "For each email");
assert.equal(report.failedAt?.why, "For each needs a list.");
assert.deepEqual(report.failedAt?.input, loopConfig);

// The wrong reference is named, with the fields that really exist (so the next attempt can fix it).
const wrong = report.failedAt?.wrongReferences?.[0];
assert.equal(wrong?.ref, "{{steps.gmail_fetch.output.preview.messages}}");
assert.match(wrong?.problem ?? "", /did not return "preview.messages"/);
assert.ok(wrong?.realFields.includes("messages (list of 1)"), "the real list is shown");

// EVERY block's input and output is included, not just the failed one.
assert.deepEqual(report.steps.map((s) => s.block), ["trigger", "gmail_fetch", "loop"]);
assert.deepEqual(report.steps[1]!.input, { max_results: 10 });
assert.deepEqual(report.steps[1]!.output, gmailOut);
assert.equal(report.steps[2]!.error, "For each needs a list.");

// A correct reference raises nothing; unknown steps are skipped; long data is cut.
assert.deepEqual(referenceProblems({ items: "{{steps.gmail_fetch.output.messages}}" }, { gmail_fetch: gmailOut }), []);
assert.deepEqual(referenceProblems({ a: "{{steps.other.output.x}}" }, { gmail_fetch: gmailOut }), []);
assert.deepEqual(referenceProblems({ a: "{{steps.gmail_fetch.output.messages.0.subject}}" }, { gmail_fetch: gmailOut }), []);
assert.equal(referenceProblems({ a: "{{steps.gmail_fetch.output.messages.0.nope}}" }, { gmail_fetch: gmailOut }).length, 1);
const big = runReport({ id: "r", status: "succeeded", steps: [{ nodeId: "a", nodeKind: "action.app", status: "succeeded", output: { t: "x".repeat(5000) } }] });
assert.ok(JSON.stringify(big.steps[0]!.output).length < 1500, "long outputs are cut");
assert.equal(runReport({ id: "r2", status: "succeeded", steps: [] }).failedAt, undefined);

// The paths of a real output are what a later block can reference.
const paths = pathsOf(gmailOut);
assert.ok(paths.includes("messages (list of 1)"));
assert.ok(paths.includes("messages.0.preview.body (string)"));
assert.ok(paths.includes("messages.0.to (empty)"));

console.log("assistant report: ok");
