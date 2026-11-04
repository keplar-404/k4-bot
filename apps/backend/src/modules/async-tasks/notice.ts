import { HumanMessage } from "@langchain/core/messages";
import { createMiddleware } from "langchain";
import type { Env } from "../../config/env";
import { registryFor } from "./registry-stub";

/**
 * Tells the bot, before its next model call, which background tasks ended since it last heard (once each), so it
 * reports them without polling. Like Deep Agents' task notifications delivered at the start of the next run.
 */
export function createAsyncNoticeMiddleware(env: Env, threadId: string) {
  return createMiddleware({
    name: "AsyncTaskNoticeMiddleware",
    beforeModel: async () => {
      const ended = await registryFor(env, threadId).unseen();
      if (!ended.length) return;
      const lines = ended.map((t) => `- ${t.id} "${t.agent}" ${t.status}. Call check_background_task("${t.id}") for its result.`);
      return { messages: [new HumanMessage(`[Automatic update] Background tasks ended:\n${lines.join("\n")}\nTell the user what they found when it fits the conversation.`)] };
    },
  });
}
