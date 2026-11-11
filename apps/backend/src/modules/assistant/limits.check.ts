import assert from "node:assert/strict";
import { MAX_FILES, MAX_MESSAGE_CHARS, messageBody } from "./limits";

// What one message to the assistant may carry: bounded text, a few files, a real workflow id.
const workflowId = crypto.randomUUID();
assert.ok(messageBody.safeParse({ content: "Build it", workflowId }).success);
assert.ok(!messageBody.safeParse({ content: "   ", workflowId }).success, "empty text is refused");
assert.ok(!messageBody.safeParse({ content: "x".repeat(MAX_MESSAGE_CHARS + 1), workflowId }).success, "too long");
const ids = Array.from({ length: MAX_FILES + 1 }, () => crypto.randomUUID());
assert.ok(!messageBody.safeParse({ content: "x", workflowId, fileIds: ids }).success, "too many files");
assert.ok(!messageBody.safeParse({ content: "x", workflowId: "not-a-uuid" }).success, "workflow id must be an id");

console.log("assistant limits: ok");
