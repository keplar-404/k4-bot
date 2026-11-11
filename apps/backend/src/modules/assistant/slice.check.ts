import assert from "node:assert/strict";
import { unfinishedNote } from "./slice";

// A turn that ends early (even after the todo guard's reminders) is never reported as "Done."
const todos = [
  { content: "Add a manual trigger", status: "completed" as const },
  { content: "Add Gmail: fetch 10 emails", status: "in_progress" as const },
  { content: "Test it", status: "pending" as const },
];
const note = unfinishedNote(todos);
assert.match(note, /1 of 3 steps done/);
assert.match(note, /Add Gmail: fetch 10 emails; Test it/);
assert.match(unfinishedNote(todos.map((t) => ({ ...t, status: "completed" as const }))), /^Done\./);

console.log("assistant slice notes: ok");
