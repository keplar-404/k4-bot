import assert from "node:assert/strict";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { Todo } from "langchain";
import { REMINDER_TAG, reminderFor } from "./todo-guard";

const call = (n: number) => new AIMessage({ content: "", tool_calls: Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: "x", args: {} })) });
const answer = new AIMessage("done");
const open: Todo[] = [{ content: "write tests", status: "pending" }];
const doneTodos: Todo[] = [{ content: "write tests", status: "completed" }];

// (a) stopping with unfinished todos → a todo reminder
assert.match(reminderFor([new HumanMessage("go"), call(1), answer], open) ?? "", /unfinished todos: write tests/);
// still calling tools → nothing
assert.equal(reminderFor([new HumanMessage("go"), call(1)], open), null);
// (b) two reminders already this turn → let it end
const twice = [new HumanMessage("go"), answer, new HumanMessage(`${REMINDER_TAG} a`), answer, new HumanMessage(`${REMINDER_TAG} b`), answer];
assert.equal(reminderFor(twice, open), null, "never more than two reminders");
// a long turn with todos done → one verify reminder, then no more
const long = [new HumanMessage("go"), call(2), call(1), answer];
assert.match(reminderFor(long, doneTodos) ?? "", /verify the result/);
assert.equal(reminderFor([...long, new HumanMessage(`${REMINDER_TAG} v`), answer], doneTodos), null, "verify asked only once");
// (c) the tool calls were in an earlier turn → no verify reminder now
assert.equal(reminderFor([...long, new HumanMessage("thanks!"), answer], doneTodos), null, "only this turn counts");

console.log("todo guard: all checks passed");
