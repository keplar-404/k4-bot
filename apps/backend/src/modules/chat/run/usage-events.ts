import { eq } from "drizzle-orm";
import type { Db } from "../../../db";
import { chatThread } from "../../../db/schema";
import type { Publish } from "./types";

/**
 * After each model call: how full the context window is (that call's input + output) and today's tokens, live to the
 * chat as `context.usage`, and the context size saved on the thread, so a reload shows the same meter.
 */
export function createUsageReporter(o: { db: Db; threadId: string; publish: Publish; contextLength: number; todayBase: number; todayLimit: number }) {
  let today = o.todayBase;
  return async (usage: { input: number; output: number }) => {
    today += usage.input + usage.output;
    const contextTokens = usage.input + usage.output;
    await o.publish("context.usage", { contextTokens, contextLength: o.contextLength, todayUsed: today, todayLimit: o.todayLimit });
    await o.db
      .update(chatThread)
      .set({ contextTokens })
      .where(eq(chatThread.id, o.threadId))
      .catch((e: unknown) => console.error("[chat-run] context size not saved", e));
  };
}
