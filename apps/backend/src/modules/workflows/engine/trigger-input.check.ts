import assert from "node:assert/strict";
import { graphSchema } from "../graph/schema";
import { triggerInput } from "./trigger-input";

// A test run gets the same trigger data as the real thing, for every trigger kind (the assistant used to send
// `{ inputs }` for all of them).
const at = { x: 0, y: 0 };
const trigger = (kind: string, config: object) => graphSchema.parse({ nodes: [{ id: "t", kind, position: at, config }], edges: [] }).nodes[0];

const hook = triggerInput(trigger("trigger.webhook", {}), { orderId: 7 }) as { body: unknown };
assert.deepEqual(hook.body, { orderId: 7 });
assert.ok("scheduledAt" in (triggerInput(trigger("trigger.schedule", { mode: "daily" }), {}) as object));
const app = triggerInput(trigger("trigger.app", { toolkit: "gmail", trigger: "GMAIL_NEW" }), { subject: "Hi" }) as { event: string; data: unknown };
assert.equal(app.event, "test");
assert.deepEqual(app.data, { subject: "Hi" });
const manual = triggerInput(trigger("trigger.manual", { fields: [{ key: "email", label: "Email", type: "text", required: true }] }), { email: "a@b.co" });
assert.deepEqual(manual, { inputs: { email: "a@b.co" } });
assert.ok("problems" in (triggerInput(trigger("trigger.manual", { fields: [{ key: "email", label: "Email", type: "text", required: true }] }), {}) as object), "a missing required field is reported");

console.log("trigger input: ok");
