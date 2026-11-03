import assert from "node:assert/strict";
import {
  appendDelta,
  friendlyProviderError,
  initialStreamState,
  reduceEvent,
} from "./stream";

// 8. classification uses the status, not digits inside the text
assert.equal(
  friendlyProviderError("x", 403),
  "That model isn't available to this app. Pick another one.",
);
assert.equal(
  friendlyProviderError("Provider returned error (request 4041-abc)", 503),
  "The model provider had a problem. Try again, or pick another model.",
  "404 inside a request id must not read as model-not-found",
);
assert.equal(
  friendlyProviderError("401 bad key"),
  "The model provider rejected the API key. Check OPENROUTER_API_KEY.",
);

// 10. interleaved reasoning + answer (models that stream both at once): one Thought, then one answer
{
  let parts: Parameters<ReturnType<typeof appendDelta>>[0] = [];
  for (const [type, d] of [
    ["reasoning", "We need to answer. So: "],
    ["text", "Hello! How can I"],
    ["reasoning", "Hello."],
    ["text", " help?"],
  ] as const)
    parts = appendDelta(type, d)(parts);
  assert.deepEqual(parts, [
    { type: "reasoning", text: "We need to answer. So: Hello." },
    { type: "text", text: "Hello! How can I help?" },
  ]);
  // reasoning that starts after the answer still goes before it
  assert.deepEqual(
    appendDelta("reasoning", "hm")([{ type: "text", text: "Hi" }]),
    [
      { type: "reasoning", text: "hm" },
      { type: "text", text: "Hi" },
    ],
  );
  // a tool call ends the turn: the next model turn gets its own blocks
  const tool = {
    type: "tool" as const,
    id: "t",
    name: "x",
    input: "{}",
    status: "done" as const,
  };
  const after = appendDelta(
    "reasoning",
    "next",
  )([{ type: "reasoning", text: "a" }, { type: "text", text: "b" }, tool]);
  assert.equal(after.length, 4);
  assert.deepEqual(after[3], { type: "reasoning", text: "next" });
}

console.log("stream-provider: all checks passed");
