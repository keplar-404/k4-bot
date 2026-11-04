/**
 * Coding-harness evals: each task runs the real coding bot (buildAgent, role "coding", its prompts, tools and
 * middleware) against a fresh E2B sandbox, then an automatic check decides pass/fail. Every sandbox is deleted.
 *
 *   bun --env-file=.dev.vars run scripts/evals/coding/run.ts [modelId ...]   (default: openrouter/free)
 *
 * Writes scripts/evals/coding/results.md. Costs: E2B minutes and the models' tokens.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Command, MemorySaver } from "@langchain/langgraph";
import { parseEnv } from "../../../src/config/env";
import { buildAgent } from "../../../src/modules/agent/agent";
import { isTransient } from "../../../src/modules/chat/run/provider-error";
import { MAX_MODEL_RETRIES, retryDelayMs } from "../../../src/modules/chat/run/types";
import { createCodingSandbox, killCoding } from "../../../src/modules/sandbox/e2b";
import { directSandbox, envWith } from "./direct-sandbox";
import { type EvalTask, TASKS } from "./tasks";

const cfg = parseEnv(process.env as never);
const models = process.argv.slice(2).length ? process.argv.slice(2) : ["openrouter/free"];
type Row = { model: string; task: string; pass: boolean; tools: number; tokens: number; seconds: number; note: string };

async function runOne(model: string, task: EvalTask): Promise<Row> {
  const started = Date.now();
  const sbx = await createCodingSandbox(cfg, { userId: "eval", botId: `eval-${task.id}` });
  try {
    for (const [path, content] of Object.entries(task.files)) await sbx.files.write(`/home/user/${path}`, content);
    const agent = buildAgent({
      bot: { id: crypto.randomUUID(), name: "Coder", description: null, role: "coding", roleTitle: null, subagentsEnabled: false, maxSubagents: 1, maxParallelTools: 4 },
      modelId: model,
      openrouterApiKey: cfg.OPENROUTER_API_KEY,
      maxOutputTokens: cfg.MAX_OUTPUT_TOKENS,
      checkpointer: new MemorySaver(),
      sandbox: { env: envWith(directSandbox(sbx), cfg), db: {} as never, userId: "eval" },
    }) as unknown as { invoke(input: unknown, config: object): Promise<{ messages: Array<{ tool_calls?: unknown[]; usage_metadata?: { total_tokens?: number } }>; __interrupt__?: unknown[] }> };
    const config = { configurable: { thread_id: task.id }, recursionLimit: 120 };
    let input: unknown = { messages: [{ role: "user", content: `${task.prompt}\n(Your sandbox is already running.)` }] };
    // Like the chat run's Workflow: a transient provider failure waits and resumes from the last checkpoint.
    const invoke = async (first: unknown) => {
      for (let attempt = 1; ; attempt++) {
        try {
          return await agent.invoke(attempt === 1 ? first : null, config);
        } catch (e) {
          if (!isTransient(e) || attempt > MAX_MODEL_RETRIES) throw e;
          await new Promise((r) => setTimeout(r, Math.min(retryDelayMs(attempt), 30_000)));
        }
      }
    };
    let out = await invoke(input);
    // An approval (e.g. a virtual-filesystem write) is approved: the eval measures the work, not the gate.
    for (let i = 0; i < 5 && out.__interrupt__?.length; i++) {
      input = new Command({ resume: { decisions: [{ type: "approve" }] } });
      out = await invoke(input);
    }
    for (const [path, content] of Object.entries(task.hidden ?? {})) await sbx.files.write(`/home/user/${path}`, content);
    const check = await sbx.commands.run(task.check, { timeoutMs: 60_000 }).catch((e: { exitCode?: number; stderr?: string }) => e);
    const tools = out.messages.reduce((n, m) => n + (m.tool_calls?.length ?? 0), 0);
    const tokens = out.messages.reduce((n, m) => n + (m.usage_metadata?.total_tokens ?? 0), 0);
    return { model, task: task.id, pass: check.exitCode === 0, tools, tokens, seconds: Math.round((Date.now() - started) / 1000), note: check.exitCode === 0 ? "" : (check.stderr ?? "").slice(0, 120).replace(/\s+/g, " ") };
  } catch (error) {
    return { model, task: task.id, pass: false, tools: 0, tokens: 0, seconds: Math.round((Date.now() - started) / 1000), note: `run failed: ${String((error as Error)?.message ?? error).slice(0, 160)}` };
  } finally {
    await killCoding(sbx.sandboxId, cfg.E2B_API_KEY);
  }
}

const rows: Row[] = [];
for (const model of models) {
  for (const task of TASKS) {
    const r = await runOne(model, task);
    rows.push(r);
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${model}  ${task.id}  tools=${r.tools} tokens=${r.tokens} ${r.seconds}s ${r.note}`);
  }
}
const table = rows.map((r) => `| ${r.model} | ${r.task} | ${r.pass ? "✅" : "❌"} | ${r.tools} | ${r.tokens} | ${r.seconds}s | ${r.note.replace(/\|/g, "\\|")} |`);
const summary = models.map((m) => `- **${m}**: ${rows.filter((r) => r.model === m && r.pass).length}/${TASKS.length} passed`);
writeFileSync(
  fileURLToPath(import.meta.url).replace(/run\.ts$/, "results.md"),
  `# Coding eval results\n\nRun ${new Date().toISOString()}.\n\n${summary.join("\n")}\n\n| Model | Task | Pass | Tool calls | Tokens | Time | Note |\n|---|---|---|---|---|---|---|\n${table.join("\n")}\n`,
);
console.log(summary.join("\n"));
