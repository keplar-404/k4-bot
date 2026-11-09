import type { Env } from "../../../config/env";
import type { Db } from "../../../db";
import type { AgentBot } from "../../agent/agent";
import { loadBotComposioApps } from "../../agent/composio/bot-apps";
import { connectBotApps } from "../../agent/mcp";
import { contextLengthOf } from "../../agent/model-context";
import { DEFAULT_MODEL_ID } from "../../agent/models";
import type { FileRef, SubagentStatus } from "../../agent/parts";
import type { GroupHub } from "../../agent/tools/subagents";
import type { ComputerStub } from "../../computer/sandbox-backend";
import type { GroupMember } from "../../groups/store";
import { loadBotSkills } from "../../integrations/skills";
import { loadMemory, saveBotMemory, savePreferences } from "../../memory/store";
import type { ChatMode } from "../modes";
import { buildRunAgent } from "./agent";
import { attachedImages, peersOf, subagentContext } from "./context";
import { situationTools } from "./situation";
import type { ChatRunParams, Publish } from "./types";

type Live = { publish: Publish; hub: GroupHub; sliceDeadline: number; progress: Map<string, SubagentStatus[]> };

/** Everything the bot's agent needs for one slice, read fresh (skills, apps, memory, context window), and the agent. */
export async function prepareAgent(
  env: Env,
  db: Db,
  run: { params: ChatRunParams; bot: AgentBot; attached: FileRef[]; mode: ChatMode; stub?: ComputerStub; group?: { groupId: string; members: GroupMember[] } },
  live: Live,
) {
  const { params, bot, stub } = run;
  const { userId } = params;
  const peers = stub ? await peersOf(db, userId, bot.id) : [];
  const images = await attachedImages(env, db, params, run.attached);
  // The bot's skills (read from R2) and connected apps (MCP servers; tokens decrypted here, for this slice only).
  const skills = env.FILES ? await loadBotSkills(env.FILES, db, userId, bot.id) : {};
  const apps = await connectBotApps(env, db, userId, bot.id);
  const composioApps = await loadBotComposioApps(db, bot.id);
  const subagents = bot.subagentsEnabled ? await subagentContext(env, db, params, live) : undefined;
  // The model's real context window: sizes the automatic summary and the chat's context meter.
  const contextLength = await contextLengthOf(params.modelId ?? DEFAULT_MODEL_ID);
  // Long-term memory: this bot's own notes and the user's global preferences, read for the prompt, saved by its tools.
  const memory = {
    ...(await loadMemory(db, userId, bot.id)),
    saveMemory: async (content: string) => void (await saveBotMemory(db, userId, bot.id, content)),
    savePreferences: (content: string) => savePreferences(db, userId, content),
  };
  const agent = buildRunAgent(env, db, params, {
    bot,
    skills,
    apps,
    subagents,
    peers,
    stub,
    images,
    contextLength,
    memory,
    mode: run.mode,
    account: { env, db, userId, apps: composioApps },
    ...situationTools(env, db, params, bot, run.group),
  });
  return { agent, apps, contextLength };
}
