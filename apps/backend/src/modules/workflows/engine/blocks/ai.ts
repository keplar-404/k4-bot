import { and, eq } from "drizzle-orm";
import { createAgent } from "langchain";
import type { Env } from "../../../../config/env";
import type { Db } from "../../../../db";
import { agentUsage, bot } from "../../../../db/schema";
import { chatModelFor } from "../../../agent/chat-model";
import { loadMemory } from "../../../memory/store";
import { aiStepPrompt } from "../../../../prompts/workflow-ai-step";
import type { WorkflowNode } from "../../graph/schema";
import { FatalBlockError } from "../errors";
import { aiStepsToday, MAX_AI_STEPS_PER_DAY, MAX_OUTPUT_TOKENS, parseJsonAnswer } from "./ai-prompt";
import { aiStepTools, toolTrace } from "./ai-tools";

type AiConfig = Extract<WorkflowNode, { kind: "ai.bot" }>["config"];

/**
 * The AI step: one of the user's bots does a task headless. It gets its own memory, web search, its knowledge files, and
 * (when allowed) read access to its connected apps. It has no tool that changes anything, starts a workflow or asks for a secret, so a
 * crafted email cannot make it act, and a workflow cannot recurse through it. `prompt` is already filled in.
 */
export async function runAi(
  env: Env,
  db: Db,
  run: { id: string; userId: string; nodeId: string },
  config: AiConfig,
  prompt: string,
) {
  if (!env.OPENROUTER_API_KEY) throw new FatalBlockError("AI steps are not set up on this server.");
  const [owner] = await db
    .select()
    .from(bot)
    .where(and(eq(bot.id, config.botId ?? ""), eq(bot.userId, run.userId)))
    .limit(1);
  if (!owner) throw new FatalBlockError("That bot no longer exists. Choose another one.");
  if ((await aiStepsToday(db, run.userId)) >= MAX_AI_STEPS_PER_DAY) {
    throw new FatalBlockError(`You've used ${MAX_AI_STEPS_PER_DAY} AI steps in 24 hours.`);
  }

  const memory = await loadMemory(db, run.userId, owner.id);
  const { tools, knowledge } = await aiStepTools(env, db, { ...run, botId: owner.id }, config);
  const { model, createModel } = chatModelFor({
    modelId: owner.modelId ?? undefined,
    reasoningEffort: owner.reasoningEffort ?? undefined,
    apiKey: env.OPENROUTER_API_KEY,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });

  const agent = createAgent({
    model: createModel(),
    tools,
    systemPrompt: aiStepPrompt(owner, memory, config.output, knowledge),
  });
  const result = await agent.invoke({ messages: [{ role: "user", content: prompt }] }, { recursionLimit: 30 });

  const usage = { input: 0, output: 0 };
  for (const m of result.messages) {
    const u = (m as { usage_metadata?: { input_tokens?: number; output_tokens?: number } }).usage_metadata;
    usage.input += u?.input_tokens ?? 0;
    usage.output += u?.output_tokens ?? 0;
  }
  await db.insert(agentUsage).values({
    userId: run.userId,
    runId: `wf:${run.id}:${run.nodeId}`,
    model: model.id,
    inputTokens: usage.input,
    outputTokens: usage.output,
  });

  const last = result.messages.at(-1);
  const text = typeof last?.content === "string" ? last.content : JSON.stringify(last?.content ?? "");
  // What it looked up, so the run viewer can show its work.
  const used = toolTrace(result.messages);
  if (config.output === "text") return { text, used };
  const json = parseJsonAnswer(text);
  if (!json)
    throw new FatalBlockError("The bot did not answer with valid JSON. Make the prompt say which fields to return.");
  return { json, used };
}
