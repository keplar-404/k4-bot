import type { Db } from "../../../db";
import { agentUsage } from "../../../db/schema";
import type { Part, PartsUsage } from "../../agent/parts";
import { appendParts } from "./relay";
import type { ChatRunParams, Publish } from "./types";

/** Coalesces tokens so the relay gets a few events a second, not one per token. */
class TokenBatcher {
  private text = "";
  private last = Date.now();
  constructor(private readonly send: (text: string) => Promise<void>) {}

  async push(text: string) {
    this.text += text;
    if (Date.now() - this.last >= 120) await this.flush();
  }

  async flush() {
    if (!this.text) return;
    const text = this.text;
    this.text = "";
    this.last = Date.now();
    await this.send(text);
  }
}

/**
 * What one slice produced: the streamed text and reasoning (batched to the relay), the parts so far (saved as they
 * finish) and the tokens used.
 */
export function createRecorder(db: Db, params: ChatRunParams, publish: Publish) {
  const tokens = new TokenBatcher((text) => publish("agent.token", { text }));
  const thoughts = new TokenBatcher((text) => publish("agent.reasoning", { text }));
  const acc = { parts: [] as Part[], usage: { input: 0, output: 0 } as PartsUsage };
  let saved = 0;

  const flushAll = async () => {
    await thoughts.flush();
    await tokens.flush();
  };

  /** Saves every finished part so far. A running tool call is kept back until it ends. */
  const saveProgress = async () => {
    let end = saved;
    while (end < acc.parts.length && !(acc.parts[end]!.type === "tool" && (acc.parts[end] as { status: string }).status === "running")) end++;
    if (end === saved) return;
    const fresh = acc.parts.slice(saved, end);
    saved = end;
    await appendParts(db, params, fresh);
  };

  /** One usage row per slice. Bookkeeping must never fail the slice. */
  const saveUsage = async (model: string) => {
    if (acc.usage.input + acc.usage.output === 0) return;
    await db
      .insert(agentUsage)
      .values({ userId: params.userId, threadId: params.threadId, runId: params.runId, model, inputTokens: acc.usage.input, outputTokens: acc.usage.output })
      .catch((e: unknown) => console.error("[chat-run] usage not recorded", e));
  };

  return { acc, tokens, thoughts, flushAll, saveProgress, saveUsage };
}
