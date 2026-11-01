/**
 * Talk to the Deep Agent from the terminal: no web app, database or Worker.
 *
 *   bun run agent:chat [modelId]      e.g. bun run agent:chat anthropic/claude-haiku-4.5
 *
 * Uses the same `buildAgent` and stream parser as the app, with in-memory
 * state. Type `exit` to quit. A paused write/edit asks you to approve it.
 */
import { createInterface } from "node:readline";
import { Command, MemorySaver } from "@langchain/langgraph";
import { buildAgent } from "./agent";
import { DEFAULT_MODEL_ID } from "./models";
import { parseChunk, type ApprovalAction } from "./stream";

const rl = createInterface({ input: process.stdin });
const lines = rl[Symbol.asyncIterator]();
/** A line iterator (not rl.question) so piped input is never dropped. */
async function ask(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  const next = await lines.next();
  if (next.done) throw new Error("input closed");
  return next.value;
}
const config = { configurable: { thread_id: "cli" } };
const agent = buildAgent({
  bot: { name: "CLI", description: null },
  modelId: process.argv[2] ?? DEFAULT_MODEL_ID,
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
  tavilyApiKey: process.env.TAVILY_API_KEY,
  checkpointer: new MemorySaver(),
  emit: ({ kind, name }) => console.log(`\n[${kind} ${name}]`),
});

let input: unknown;
for (;;) {
  try {
    if (!input) {
      const line = (await ask("\nyou> ")).trim();
      if (line === "exit") break;
      if (!line) continue;
      input = { messages: [{ role: "user", content: line }] };
    }

    const stream = await agent.stream(input as never, {
      ...config,
      streamMode: ["updates", "messages"],
      durability: "sync",
    } as never);
    input = undefined;

    process.stdout.write("bot> ");
    let approval: ApprovalAction[] | undefined;
    let tokens = 0;
    for await (const chunk of stream as AsyncIterable<unknown>) {
      const parsed = parseChunk(chunk);
      if (parsed.text) process.stdout.write(parsed.text);
      tokens += (parsed.usage?.input ?? 0) + (parsed.usage?.output ?? 0);
      approval ??= parsed.approval;
    }
    console.log(`\n(${tokens} tokens)`);

    if (approval) {
      const names = approval.map((a) => `${a.name} ${JSON.stringify(a.args)}`).join(", ");
      const ok = (await ask(`approve ${names}? [y/N] `)).trim().toLowerCase() === "y";
      input = new Command({
        resume: { decisions: approval.map(() => (ok ? { type: "approve" } : { type: "reject" })) },
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
