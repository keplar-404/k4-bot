import assert from "node:assert/strict";
import { handoffsOf, mergeTurns, turnContent } from "./chain";

const a = { id: "a", name: "Researcher" };
const b = { id: "b", name: "Writer" };
const tool = (input: unknown, status = "done") => ({ type: "tool", id: "1", name: "message_bot", input: JSON.stringify(input), status });
const parts = [
  { type: "text", text: "hi" },
  tool({ bot: "@bot:writer", text: "Draft it", fileIds: ["f1"] }),
  tool({ bot: "Researcher", text: "self" }),
  tool({ bot: "ghost", text: "x" }),
  tool({ bot: "writer", text: "failed" }, "error"),
  { type: "tool", id: "2", name: "message_bot", input: "{broken", status: "done" },
];
assert.deepEqual(handoffsOf(parts, [a, b], a), [{ botId: "b", task: "Draft it", from: "Researcher", fileIds: ["f1"] }]);
assert.deepEqual(handoffsOf(null, [a, b], a), []);
assert.equal(turnContent({ botId: "b", task: "go", from: "Researcher" }), "Researcher asks you, quoted: «go»");
assert.equal(turnContent({ botId: "b", task: "go", from: "User" }), "The user wrote, quoted: «go»");
// A hand-off to a bot already queued joins its turn; a new one goes first.
const merged = mergeTurns([{ botId: "b", task: "x", from: "A" }, { botId: "c", task: "y", from: "A" }], [{ botId: "b", task: "user ask", from: "User" }]);
assert.deepEqual(merged.map((t) => t.botId), ["c", "b"]);
assert.match(merged[1]!.task!, /user ask[\s\S]*Also, A asks you: x/);
console.log("chain ok");
