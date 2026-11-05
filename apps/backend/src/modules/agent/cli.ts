/**
 * Talk to the Deep Agent from the terminal: no web app, database or Worker.
 *
 *   bun run agent:chat [modelId]      e.g. bun run agent:chat anthropic/claude-haiku-4.5
 *
 * Uses the same `buildAgent` and `consumeRun` as the app, with in-memory
 * state and no computer. Type `exit` to quit. A paused write/edit asks you to approve it.
 */
import { createInterface } from "node:readline";
import { Command, MemorySaver } from "@langchain/langgraph";
import { buildAgent } from "./agent";
import { DEFAULT_MODEL_ID } from "./models";
import type { Part } from "./parts";
import { consumeRun, type RunStream } from "./run-stream";

const rl = createInterface({ input: process.stdin });
const lines = rl[Symbol.asyncIterator]();
/** A line iterator (not rl.question) so piped input is never dropped. */
async function ask(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  const next = await lines.next();
  if (next.done) throw new Error("input closed");
  return next.value;
}
const config = { version: "v3", configurable: { thread_id: "cli" }, durability: "sync" };
const agent = buildAgent({
  bot: { id: crypto.randomUUID(), name: "CLI", description: null, role: "assistant", roleTitle: null, subagentsEnabled: false, maxSubagents: 5, maxParallelTools: 5 },
  modelId: process.argv[2] ?? DEFAULT_MODEL_ID,
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
  web: process.env.TAVILY_API_KEY ? { apiKey: process.env.TAVILY_API_KEY } : undefined,
  checkpointer: new MemorySaver(),
}) as unknown as { streamEvents(input: unknown, config: object): Promise<RunStream> };

let input: unknown;
for (;;) {
  try {
    if (!input) {
      const line = (await ask("\nyou> ")).trim();
      if (line === "exit") break;
      if (!line) continue;
      input = { messages: [{ role: "user", content: line }] };
    }

    const stream = await agent.streamEvents(input, config);
    input = undefined;

    process.stdout.write("bot> ");
    const acc = { parts: [] as Part[], usage: { input: 0, output: 0 } };
    const { interrupt } = await consumeRun(
      stream,
      {
        text: (delta) => void process.stdout.write(delta),
        toolStart: (part) => void console.log(`\n[tool ${part.name}]`),
      },
      acc,
    );
    console.log(`\n(${acc.usage.input + acc.usage.output} tokens)`);

    const actions = (interrupt?.payload as { actionRequests?: Array<{ name: string; args: unknown }> } | undefined)?.actionRequests;
    if (actions) {
      const names = actions.map((a) => `${a.name} ${JSON.stringify(a.args)}`).join(", ");
      const ok = (await ask(`approve ${names}? [y/N] `)).trim().toLowerCase() === "y";
      input = new Command({
        resume: { decisions: actions.map(() => (ok ? { type: "approve" } : { type: "reject" })) },
      });
    }
  } catch (error) {
    // Closed stdin (piped input ran out) ends the session; anything else is a
    // model/provider failure worth seeing as-is, with its HTTP status.
    if (error instanceof Error && error.message === "input closed") break;
    const status = (error as { status?: number }).status;
    console.error(`\n[error${status ? ` ${status}` : ""}] ${error instanceof Error ? error.message : error}`);
    input = undefined;
  }
}
rl.close();
