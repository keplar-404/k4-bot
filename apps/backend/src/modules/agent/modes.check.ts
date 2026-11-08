import assert from "node:assert/strict";
import { ToolMessage } from "@langchain/core/messages";
import type { InterruptOnConfig } from "langchain";
import { MODES } from "../chat/modes";
import { botMiddleware } from "./middleware/stack";
import { createPlanMiddleware } from "./middleware/plan-guard";
import { modeSetup } from "./mode-setup";
import { approvalsFor, planAllows } from "./modes";
import type { BuildAgentOptions } from "./options";

const ask: InterruptOnConfig = { allowedDecisions: ["approve", "reject"] };
const base = {
  write_file: ask,
  turn_on_computer: ask,
  sandbox_delete: ask,
  app_act: ask,
  run_workflow: ask,
  airtable_update_record: ask,
};

// Ask keeps every approval; Allow all keeps only the two that cost money or destroy data; Plan offers nothing that needs one.
assert.deepEqual(approvalsFor("ask", base), base);
assert.deepEqual(Object.keys(approvalsFor("allow_all", base)).sort(), ["sandbox_delete", "turn_on_computer"]);
assert.deepEqual(approvalsFor("plan", base), {});

// Plan is an allow-list: reading and asking pass; everything that changes anything (known or not) is refused.
for (const ok of [
  "app_read",
  "app_find_actions",
  "tavily_search",
  "read_file",
  "write_todos",
  "ask_user",
  "request_mode_switch",
  "list_my_workflows",
  "sandbox_read",
])
  assert.ok(planAllows(ok), ok);
for (const no of [
  "app_act",
  "run_workflow",
  "turn_on_workflow",
  "create_workflow",
  "request_secret",
  "write_file",
  "edit_file",
  "execute",
  "sandbox_write",
  "sandbox_edit",
  "sandbox_exec",
  "computer",
  "airtable_update_record",
  "some_future_tool",
  "undefined",
])
  assert.ok(!planAllows(no), no);
assert.ok(planAllows("shadcn_search_items", ["shadcn_search_items"]), "a connected app's read-only tool stays");
assert.ok(!planAllows("airtable_update_record", ["shadcn_search_items"]));

// The middleware offers only allowed tools, and a call to any other tool becomes a real ToolMessage (it never runs).
const mw = createPlanMiddleware((n) => planAllows(n));
const offered: string[] = [];
await (mw.wrapModelCall as (r: unknown, h: unknown) => unknown)(
  { tools: [{ name: "app_read" }, { name: "app_act" }, { name: "write_file" }] },
  (r: { tools: Array<{ name: string }> }) => (offered.push(...r.tools.map((t) => t.name)), {}),
);
assert.deepEqual(offered, ["app_read"]);
let ran = 0;
const handler = () => (ran++, new ToolMessage({ content: "ok", tool_call_id: "x" }));
const call = (name: string) =>
  (mw.wrapToolCall as (r: unknown, h: unknown) => Promise<ToolMessage>)(
    { toolCall: { name, id: "c1", args: {} } },
    handler,
  );
const refused = await call("app_act");
assert.ok(
  ToolMessage.isInstance(refused) && refused.status === "error" && refused.tool_call_id === "c1" && ran === 0,
  "refused with a ToolMessage, handler not called",
);
assert.equal((await call("app_read")).content, "ok");
assert.equal(ran, 1);
// LangChain refuses an agent with two middlewares of the same name: every mode's full stack must be unique.
for (const mode of MODES) {
  const modes = modeSetup({ mode } as BuildAgentOptions, {});
  const stack = botMiddleware({ botId: "b", maxParallelTools: 4, summarize: { model: {} as never, backend: {} as never }, extra: modes.middleware });
  const names = stack.map((m) => m.name);
  assert.equal(new Set(names).size, names.length, `${mode}: duplicate middleware in ${names.join(", ")}`);
}

console.log("modes: all checks passed");
