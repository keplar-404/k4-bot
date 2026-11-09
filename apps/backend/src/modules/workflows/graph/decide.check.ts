// bun run src/modules/workflows/graph/decide.check.ts
import assert from "node:assert/strict";
import { decideConfig } from "./decide-block";
import { decideIssue } from "./decide-issues";

const cfg = (v: Record<string, unknown>) => decideConfig.parse(v);
assert.match(decideIssue(cfg({ questions: [] }))!, /state/);
assert.match(decideIssue(cfg({ state: "x" }))!, /at least one question/);
assert.match(decideIssue(cfg({ state: "x", questions: [{ id: "a", type: "noul", instructions: "" }] }))!, /Write question/);
assert.match(
  decideIssue(cfg({ state: "x", questions: [{ id: "a", type: "choice", instructions: "Which?", choices: [{ label: "one" }] }] }))!,
  /two choices/,
);
assert.match(decideIssue(cfg({ state: "x", questions: [{ id: "a", type: "score", instructions: "How?", levels: ["low"] }] }))!, /two levels/);
assert.match(
  decideIssue(cfg({ state: "x", questions: [{ id: "a", type: "noul", instructions: "Q" }, { id: "a", type: "noul", instructions: "Q" }] }))!,
  /Two questions/,
);
assert.equal(
  decideIssue(cfg({ state: "{{trigger.body.text}}", questions: [{ id: "angry", type: "noul", instructions: "Is the customer angry?" }] })),
  null,
);
assert.equal(decideConfig.safeParse({ questions: [{ id: "Bad Id", type: "noul", instructions: "Q" }] }).success, false);
assert.equal(cfg({}).model, "jev-latest");
console.log("decide block: all checks passed");
