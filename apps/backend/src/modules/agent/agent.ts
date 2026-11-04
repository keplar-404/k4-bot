import { createDeepAgent } from "deepagents";
import { botHome, botUnixUser } from "../computer/guards";
import { createComputerTools, type ScreenHolder } from "../computer/tools";
import { computerApprovals, fileApprovals, sandboxApprovals } from "./approvals";
import { chatModelFor, extraModel } from "./chat-model";
import { domainFor } from "./domains";
import type { BotApps } from "./mcp";
import { botMiddleware } from "./middleware/stack";
import type { BuildAgentOptions } from "./options";
import { computerPrompt } from "./prompts/computer";
import { systemPrompt } from "./prompts/system";
import { SKILLS_ROOT } from "./skills-backend";
import { createFileTools, type ViewHolder } from "./tools/files";
import { createAsyncNoticeMiddleware } from "../async-tasks/notice";
import { featureTools } from "./feature-tools";
import { createSubagentTools } from "./tools/subagents";
import { createWebTools } from "./tools/web";
import { createWorkspace } from "./workspace";

export type { AgentBot, BuildAgentOptions } from "./options";

export function buildAgent(options: BuildAgentOptions) {
  const { bot, openrouterApiKey, checkpointer, computer } = options;
  if (!openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured; the agent has no model to call.");
  }
  const { model, createModel } = chatModelFor({ ...options, apiKey: openrouterApiKey });
  // The role decides the playbook, the web tools and what its sub-agents are told.
  const domain = domainFor(bot.role);
  const today = new Date().toISOString().slice(0, 10);
  const unix = botUnixUser(bot.id);
  const home = computer && unix.ok ? botHome(unix.value) : undefined;
  const { backend, hasSkills, saveGroupFiles } = createWorkspace({ botId: bot.id, computer: computer?.stub, home, skills: options.skills });

  const subagentTools =
    bot.subagentsEnabled && options.subagents
      ? createSubagentTools({
          ...options.subagents,
          modelId: model.id,
          createModel,
          botName: bot.name,
          maxAgents: bot.maxSubagents,
          maxParallelTools: bot.maxParallelTools,
          today,
          brief: domain.subagentBrief,
          // Sub-agents share the lead's guard (one budget per run) but never get tavily_research.
          webTools: options.web ? createWebTools({ ...options.web, research: false }) : [],
          botApps: options.apps as BotApps | undefined,
          saveFiles: saveGroupFiles,
        })
      : [];

  const screen: ScreenHolder = {};
  const computerTools = computer ? createComputerTools({ computer: computer.stub, botId: bot.id, runId: computer.runId, screen }) : [];
  // Without vision the model cannot use the screen, so it is not offered the mouse and keyboard.
  const view: ViewHolder = { images: model.vision ? (options.files?.attached ?? []) : [] };
  const fileTools = options.files
    ? createFileTools({ ...options.files, botId: bot.id, openrouterApiKey, vision: model.vision, view, ...(computer && home ? { computer: { stub: computer.stub, home } } : {}) })
    : [];
  const features = featureTools(options);
  const tools = [
    ...(options.web ? createWebTools(options.web) : []),
    ...subagentTools,
    ...computerTools.filter((t) => model.vision || t.name !== "computer"),
    ...fileTools,
    ...features.tools,
  ];
  const approvals = { ...(computer ? computerApprovals : fileApprovals), ...(options.sandbox ? sandboxApprovals : {}), ...(options.apps?.approvals ?? {}) };

  return createDeepAgent({
    model: createModel(),
    tools,
    backend,
    // Deep Agents' skills system: names and descriptions in the prompt, the full SKILL.md read on demand.
    ...(hasSkills ? { skills: [SKILLS_ROOT] } : {}),
    middleware: botMiddleware({
      botId: bot.id,
      maxParallelTools: bot.maxParallelTools,
      pausing: options.subagents ? { hub: options.subagents.hub, names: [...Object.keys(approvals), "ask_user", "wait_for", "spawn_subagents"] } : undefined,
      computer: computer ? { stub: computer.stub, screen } : undefined,
      view: model.vision && options.files ? view : undefined,
      summarize: { model: createModel(["nostream"]), backend, now: options.compact },
      freeVision: model.id === "openrouter/free" && options.freeVisionModel ? extraModel(options.freeVisionModel, openrouterApiKey, options.maxOutputTokens) : undefined,
      extra: features.asyncTasks ? [createAsyncNoticeMiddleware(features.asyncTasks.env, features.asyncTasks.threadId)] : [],
      appReadOnlyTools: Object.values(options.apps?.readOnly ?? {}).flatMap((ts) => ts.map((t) => t.name)),
    }),
    systemPrompt: systemPrompt({
      bot,
      files: options.files ? { canSee: model.vision } : undefined,
      skills: hasSkills ? { onComputer: Boolean(home) } : undefined,
      apps: options.apps?.names.length ? { names: options.apps.names, unavailable: options.apps.unavailable } : undefined,
      capabilities: { maxParallelTools: bot.maxParallelTools, maxSubagents: subagentTools.length ? bot.maxSubagents : undefined },
      today,
      computer: home ? computerPrompt(home, model.vision, options.peers) : undefined,
      memory: options.memory ? { memory: options.memory.memory, preferences: options.memory.preferences } : undefined,
    }),
    // Connected-app tools that change the user's data (e.g. Airtable record updates) ask first, like waking the computer.
    interruptOn: approvals,
    checkpointer,
  });
}
