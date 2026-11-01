import assert from "node:assert/strict";
import { AIMessageChunk, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { parseChunk } from "./stream";

const model = { langgraph_node: "model_request" };

// Answer text and usage come from AI chunks.
const ai = new AIMessageChunk({
  content: "Hi",
  usage_metadata: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
});
assert.deepEqual(parseChunk(["messages", [ai, model]]), {
  text: "Hi",
  usage: { input: 10, output: 2 },
});

// Tool output and the user's own message must never become answer text.
const tool = new ToolMessage({ content: "search results...", tool_call_id: "1" });
assert.equal(parseChunk(["messages", [tool, { langgraph_node: "tools" }]]).text, undefined);
assert.equal(parseChunk(["messages", [new HumanMessage("hi"), model]]).text, undefined);

// An empty AI chunk (e.g. the final usage-only one) yields no text.
assert.equal(parseChunk(["messages", [new AIMessageChunk(""), model]]).text, undefined);

// Plain updates are ignored; an interrupt is surfaced with its actions.
assert.deepEqual(parseChunk(["updates", { model_request: {} }]), {});
const paused = parseChunk([
  "updates",
  {
    __interrupt__: [
      {
        id: "i1",
        value: {
          actionRequests: [{ name: "write_file", args: { path: "/a.txt" }, description: "x" }],
          reviewConfigs: [],
        },
      },
    ],
  },
]);
assert.deepEqual(paused.approval, [{ name: "write_file", args: { path: "/a.txt" } }]);

console.log("stream.check: ok");
