import assert from "node:assert/strict";
import { scheduleConfig } from "../../schedules/config";
import { graphSchema, LIMITS, type WorkflowGraph } from "./schema";
import { hashToken, newWebhookToken, nextRunAt } from "./triggers";
import { publishIssues, structureIssues, topoOrder } from "./validate";

const pos = { x: 0, y: 0 };
const trigger = { id: "t", kind: "trigger.manual" as const, position: pos, config: { fields: [] } };
const app = (id: string, done = true) => ({
  id,
  kind: "action.app" as const,
  position: pos,
  config: done
    ? { toolkit: "gmail", tool: "GMAIL_SEND_EMAIL", version: "20261105_00", arguments: {} }
    : { arguments: {} },
  onError: "stop" as const,
});
const g = (nodes: WorkflowGraph["nodes"], edges: WorkflowGraph["edges"]): WorkflowGraph => ({ nodes, edges });
const e = (source: string, target: string, branch?: "true" | "false") => ({
  id: `${source}-${target}`,
  source,
  target,
  branch,
});

// A straight line is valid and runs in order.
const line = g([trigger, app("a"), app("b")], [e("t", "a"), e("a", "b")]);
assert.deepEqual(structureIssues(line), []);
assert.deepEqual(publishIssues(line), []);
assert.deepEqual(topoOrder(line), ["t", "a", "b"]);

// A loop is refused on save: no workflow can run forever by design.
const loop = g([trigger, app("a"), app("b")], [e("t", "a"), e("a", "b"), e("b", "a")]);
assert.match(structureIssues(loop)[0]!.message, /loop/);
assert.equal(topoOrder(loop), null);

// Nothing may lead into a trigger; one trigger per workflow; no self-edges or duplicates.
assert.ok(
  structureIssues(g([trigger, app("a")], [e("t", "a"), e("a", "t")])).some((i) => /trigger starts/.test(i.message)),
);
assert.ok(structureIssues(g([trigger, { ...trigger, id: "t2" }], [])).some((i) => /one trigger/.test(i.message)));
assert.ok(structureIssues(g([trigger, app("a")], [e("a", "a")])).some((i) => /itself/.test(i.message)));
assert.ok(structureIssues(g([trigger, app("a")], [e("t", "a"), e("t", "a")])).some((i) => /twice/.test(i.message)));
assert.ok(structureIssues(g([trigger], [e("t", "ghost")])).some((i) => /does not exist/.test(i.message)));

// If blocks branch, nothing else does.
const iff = {
  id: "if",
  kind: "logic.if" as const,
  position: pos,
  config: { combine: "all" as const, conditions: [{ left: "{{trigger.x}}", op: "exists" as const }], groups: [] },
};
assert.deepEqual(structureIssues(g([trigger, iff, app("a")], [e("t", "if"), e("if", "a", "true")])), []);
assert.ok(
  structureIssues(g([trigger, iff, app("a")], [e("t", "if"), e("if", "a")])).some((i) =>
    /true or false output/.test(i.message),
  ),
);
assert.ok(structureIssues(g([trigger, app("a")], [e("t", "a", "true")])).some((i) => /several outputs/.test(i.message)));

// Publish needs a trigger, every block wired and filled in.
assert.ok(publishIssues(g([app("a")], [])).some((i) => /Add a trigger/.test(i.message)));
assert.ok(
  publishIssues(g([trigger, app("a"), app("b")], [e("t", "a")])).some(
    (i) => i.nodeId === "b" && /not connected/.test(i.message),
  ),
);
assert.ok(publishIssues(g([trigger, app("a", false)], [e("t", "a")])).some((i) => /Choose an app/.test(i.message)));
const fast = {
  id: "t",
  kind: "trigger.schedule" as const,
  position: pos,
  config: scheduleConfig.parse({ every: 1, unit: "minutes", timezone: "UTC" }),
};
assert.ok(publishIssues(g([fast, app("a")], [e("t", "a")])).some((i) => /every 5 minutes/.test(i.message)));

// The schema itself caps size: no oversized graph is ever stored.
const many = Array.from({ length: LIMITS.nodes + 1 }, (_, i) => app(`n${i}`));
assert.equal(graphSchema.safeParse(g(many, [])).success, false);
assert.equal(graphSchema.safeParse(g([{ ...trigger, id: "bad id!" }], [])).success, false);

// Schedules land on a whole minute; webhook tokens are long, unique, and only their hash is kept.
const every5 = { ...fast, config: { ...fast.config, every: 5 } };
const next = nextRunAt(every5, Date.UTC(2026, 0, 1, 10, 0, 30))!;
assert.equal(next.toISOString(), "2026-01-01T10:06:00.000Z");
const a = await newWebhookToken();
const b = await newWebhookToken();
assert.ok(a.token.length >= 43 && a.token !== b.token);
assert.equal(a.hash, await hashToken(a.token));

console.log("workflow graph: all checks passed");
