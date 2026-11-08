import assert from "node:assert/strict";
import { publishIssues } from "./validate";

// Publishing rules: secrets only in app/HTTP blocks, delays at most 7 days in total
const trigger = { id: "t", kind: "trigger.manual", position: { x: 0, y: 0 }, config: {} };
const withSet = (value: string) =>
  ({
    nodes: [
      trigger,
      { id: "s", kind: "logic.set", position: { x: 0, y: 0 }, config: { fields: [{ key: "k", value }] } },
    ],
    edges: [{ id: "e", source: "t", target: "s" }],
  }) as never;
assert.ok(publishIssues(withSet("{{secrets.API_KEY}}")).some((i) => /Secrets can only/.test(i.message)));
assert.equal(publishIssues(withSet("plain")).length, 0);

const twoDelays = (days: number) =>
  ({
    nodes: [
      trigger,
      ...["d1", "d2"].map((id) => ({
        id,
        kind: "logic.delay",
        position: { x: 0, y: 0 },
        config: { amount: days, unit: "days" },
      })),
    ],
    edges: [
      { id: "e1", source: "t", target: "d1" },
      { id: "e2", source: "d1", target: "d2" },
    ],
  }) as never;
assert.ok(
  publishIssues(twoDelays(4)).some((i) => /together/.test(i.message)),
  "two 4-day delays are over 7 days",
);
assert.equal(publishIssues(twoDelays(3)).length, 0);

console.log("publish rules: all checks passed");
