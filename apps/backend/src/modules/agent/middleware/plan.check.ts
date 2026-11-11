import assert from "node:assert/strict";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { planOf, planProblem } from "./plan";

const step = (title: string, status: "pending" | "in_progress" | "completed" | "cancelled", evidence?: string) => ({
  id: title.slice(0, 3),
  title,
  status,
  ...(evidence ? { evidence } : {}),
});

// planOf reads the last plan call of the turn, in array order.
const messages = [
  new HumanMessage({ content: "build it" }),
  new AIMessage({ content: "", tool_calls: [{ name: "get_workflow", args: {}, id: "t0" }] }),
  new AIMessage({
    content: "",
    tool_calls: [
      {
        name: "create_plan",
        args: { goal: "g", steps: [{ title: "Read the workflow" }, { title: "Add the Gmail step" }, { title: "Test it" }] },
        id: "t1",
      },
    ],
  }),
];
const plan = planOf(messages);
assert.equal(plan?.length, 3);
assert.deepEqual(plan?.map((s) => s.status), ["pending", "pending", "pending"]);

// order: cannot start step 2 while step 1 is open
assert.match(planProblem([step("one", "pending"), step("two", "in_progress")]) ?? "", /earlier steps/);
// completed needs evidence
assert.match(planProblem([step("one", "completed"), step("two", "pending")]) ?? "", /evidence/);
// only one in_progress
assert.match(planProblem([step("one", "in_progress"), step("two", "in_progress")]) ?? "", /one step/);
// ordered and evidenced is accepted
assert.equal(planProblem([step("one", "completed", "read it"), step("two", "in_progress")]), null);

console.log("plan.check: ok");
