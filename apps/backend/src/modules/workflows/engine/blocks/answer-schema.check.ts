import assert from "node:assert/strict";
import { answerSchema } from "./answer-schema";

// The fields a user builds become the exact shape the model must answer in.
const schema = answerSchema([
  { name: "urgent", type: "boolean", description: "true if it needs an answer today", choices: [] },
  { name: "reply", type: "text", description: "", choices: [] },
  { name: "score", type: "number", description: "", choices: [] },
  { name: "tags", type: "list", description: "", choices: [] },
  { name: "team", type: "enum", description: "", choices: ["sales", "support", " "] },
]);

const good = { urgent: true, reply: "Hi", score: 3, tags: ["a"], team: "sales" };
assert.deepEqual(schema.parse(good), good);
assert.ok(!schema.safeParse({ ...good, team: "spam" }).success, "an enum answer must be one of the choices");
assert.ok(!schema.safeParse({ ...good, score: "3" }).success, "a number must be a number");
assert.ok(!schema.safeParse({ reply: "Hi" }).success, "every field is required");
assert.equal(schema.shape.urgent.description, "true if it needs an answer today");

console.log("answer-schema: ok");
