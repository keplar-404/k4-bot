import assert from "node:assert/strict";
import { DEFAULT_MODEL_ID } from "../../agent/models";
import { toPortable } from "./portable";
import { graphSchema } from "./schema";
import { publishIssues } from "./validate";

// Ask a bot: who answers (bot or normal model), and the structured answer's rules.
const at = { x: 0, y: 0 };
const withAi = (config: Record<string, unknown>) =>
  graphSchema.parse({
    nodes: [
      { id: "t", kind: "trigger.manual", position: at, config: {} },
      { id: "a", kind: "ai.bot", position: at, config: { prompt: "Summarize", ...config } },
    ],
    edges: [{ id: "e", source: "t", target: "a" }],
  });
const issue = (config: Record<string, unknown>) => publishIssues(withAi(config)).find((i) => i.nodeId === "a")?.message;

// Saved before "normal" existed: still a bot block, still needs its bot.
const old = withAi({}).nodes[1]!;
assert.ok(old.kind === "ai.bot" && old.config.agent === "bot");
assert.match(issue({}) ?? "", /Choose the bot/);
assert.equal(issue({ botId: "b1" }), undefined);

// Normal: needs a known model, no bot.
assert.match(issue({ agent: "normal" }) ?? "", /Choose the model/);
assert.match(issue({ agent: "normal", modelId: "nope/model" }) ?? "", /Choose the model/);
assert.equal(issue({ agent: "normal", modelId: DEFAULT_MODEL_ID }), undefined);

// Structured: at least one field; "one of" needs two choices; names are unique.
const normal = { agent: "normal", modelId: DEFAULT_MODEL_ID, output: "structured" };
assert.match(issue(normal) ?? "", /at least one answer field/);
assert.match(issue({ ...normal, schema: [{ name: "team", type: "enum", choices: ["a"] }] }) ?? "", /two choices/);
assert.equal(issue({ ...normal, schema: [{ name: "urgent", type: "boolean" }] }), undefined);
assert.throws(() => withAi({ ...normal, schema: [{ name: "x" }, { name: "x" }] }), /own name/);

// Export keeps the model and the fields; a normal block is not a bot to pick.
const out = toPortable({ name: "W", description: null, graph: withAi({ ...normal, schema: [{ name: "urgent", type: "boolean" }] }) });
const ai = out.graph.nodes[1]!;
assert.ok(ai.kind === "ai.bot" && ai.config.modelId === DEFAULT_MODEL_ID && ai.config.schema.length === 1);
assert.equal(out.requires.bots, 0);

console.log("ai-block: ok");
