import type { DomainSpec } from "./domains";
import type { BotApps } from "./mcp";
import type { BuildAgentOptions } from "./options";
import { createSubagentTools, type SubagentToolsOptions } from "./tools/subagents";
import { createWebTools } from "./tools/web";

/** The lead's sub-agent tools (spawn_subagents and friends), for bots that have the capability and this run's context. */
export function subagentToolsFor(
  options: BuildAgentOptions,
  run: {
    model: { id: string };
    createModel: SubagentToolsOptions["createModel"];
    domain: DomainSpec;
    today: string;
    saveFiles: SubagentToolsOptions["saveFiles"];
  },
) {
  const { bot } = options;
  if (!bot.subagentsEnabled || !options.subagents) return [];
  return createSubagentTools({
    ...options.subagents,
    modelId: run.model.id,
    createModel: run.createModel,
    botName: bot.name,
    maxAgents: bot.maxSubagents,
    maxParallelTools: bot.maxParallelTools,
    today: run.today,
    brief: run.domain.subagentBrief,
    // Sub-agents get the web tools but never tavily_research.
    webTools: options.web ? createWebTools({ apiKey: options.web.apiKey }) : [],
    botApps: options.apps as BotApps | undefined,
    saveFiles: run.saveFiles,
  });
}
