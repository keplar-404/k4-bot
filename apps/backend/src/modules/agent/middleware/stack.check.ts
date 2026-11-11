import assert from "node:assert/strict";
import { HumanMessage } from "@langchain/core/messages";
import { createFreeVisionMiddleware } from "./free-vision";
import { botMiddleware } from "./stack";
import { RETRY_SAFE_TOOLS } from "./tool-retry";

const model = { id: "fake" } as never;
const names = (free: boolean) =>
  botMiddleware({ botId: "b", maxParallelTools: 2, summarize: { model, backend: {} as never }, freeVision: free ? model : undefined }).map((m) => m.name);

const all = names(true);
assert.equal(all.filter((n) => n === "SummarizationMiddleware").length, 1, "the summarizer runs exactly once (it replaces Deep Agents' default)");
assert.ok(all.includes("FreeVisionMiddleware"), "free-vision is on with the free router");
assert.ok(!names(false).includes("FreeVisionMiddleware"));
assert.ok(all.includes("PlanMiddleware"), "the ordered plan gate is installed");
assert.ok(!all.includes("TodoGuardMiddleware"), "the built-in todo guard was replaced by PlanMiddleware");
assert.ok(all.indexOf("FreeVisionMiddleware") === all.length - 1, "free-vision is innermost (it sees the pictures)");

// Side-effecting tools are never retried: a second try would click, run or write twice.
for (const t of RETRY_SAFE_TOOLS) assert.ok(!/^(computer|sandbox_|share_file|copy_to_computer|generate_image|write_file|edit_file)/.test(t), `${t} must not be retried`);

// The free-vision switch: a call with a picture goes to the vision model; a text-only call stays.
const vision = { id: "vision" } as never;
const mw = createFreeVisionMiddleware(vision);
const seen: unknown[] = [];
const handler = (req: { model: unknown }) => (seen.push(req.model), {}) as never;
const run = (content: HumanMessage["content"]) => (mw.wrapModelCall as (r: unknown, h: unknown) => unknown)({ model: "router", messages: [new HumanMessage({ content })] }, handler);
run("just text");
run([{ type: "text", text: "page" }, { type: "image_url", image_url: { url: "data:image/png;base64,AA" } }]);
assert.deepEqual(seen, ["router", vision]);

console.log("middleware stack: all checks passed");
