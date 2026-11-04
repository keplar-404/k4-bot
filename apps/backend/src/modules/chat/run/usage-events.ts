import { eq } from "drizzle-orm";
import type { Db } from "../../../db";
import { chatThread } from "../../../db/schema";
import type { Publish } from "./types";

/**
 * After each model call: how full the context window is (that call's input + output) and today's tokens, live to the
 * chat as `context.usage`, and the context size saved on the thread, so a reload shows the same meter.
 */
export function createUsageReporter(o: { db: Db; threadId: string; publish: Publish; contextLength: number; todayBase: number; todayLimit: number; counted: boolean }) {
  let today = o.todayBase;
  let shown = 0;
  return async (usage: { input: number; output: number; cached: number }) => {
    // A free model's tokens do not count against today's budget.
    if (o.counted) today += usage.input + usage.output;
    const call = usage.input + usage.output;
    // A call right after a computer action also carries the screenshot (~1.5k tokens, never saved), so the raw
    // count jumps up and down from step to step. The conversation itself only grows within a slice, so the meter
    // keeps its highest value, unless the drop is big enough to be a summary (Deep Agents' or /compact's).
    const contextTokens = call >= shown * 0.6 ? Math.max(shown, call) : call;
    shown = contextTokens;
    // `cachedTokens`: how much of this call's input came from the provider's prompt cache.
    await o.publish("context.usage", { contextTokens, cachedTokens: usage.cached, contextLength: o.contextLength, todayUsed: today, todayLimit: o.todayLimit });
    await o.db
      .update(chatThread)
      .set({ contextTokens })
      .where(eq(chatThread.id, o.threadId))
      .catch((e: unknown) => console.error("[chat-run] context size not saved", e));
  };
}
