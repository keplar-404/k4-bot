import { ChatOpenRouter } from "@langchain/openrouter";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import { CompositeBackend, StateBackend, createDeepAgent } from "deepagents";
import { piiMiddleware, type InterruptOnConfig } from "langchain";
import { botHome, botUnixUser } from "../computer/guards";
import { createScreenMiddleware } from "../computer/screen-middleware";
import { ComputerSandbox, type ComputerStub } from "../computer/sandbox-backend";
import { createComputerTools, type ScreenHolder } from "../computer/tools";
import { DEFAULT_MODEL_ID, resolveModel } from "./models";
import { systemPrompt } from "./prompts/system";
import { createFileTools, type FileToolsOptions, type ViewHolder } from "./tools/files";
import { domainFor } from "./domains";
import type { BotApps } from "./mcp";
import { createGroupGuardMiddleware, createHideToolsMiddleware } from "./middleware/hide-tools";
import { createParallelToolsMiddleware } from "./middleware/parallel-tools";
import { createToolErrorsMiddleware } from "./middleware/tool-errors";
import { SKILLS_ROOT, SkillsBackend } from "./skills-backend";
import { createSubagentTools, type SubagentToolsOptions } from "./tools/subagents";
import { createWebTools } from "./tools/web";
import { createViewMiddleware } from "./view-middleware";

/** The bot as the agent needs it: identity, role (its domain) and capabilities. */
export interface AgentBot {
  id: string;
  name: string;
  description: string | null;
  role: string;
  roleTitle: string | null;
  subagentsEnabled: boolean;
  maxSubagents: number;
  maxParallelTools: number;
}

export interface BuildAgentOptions {
  bot: AgentBot;
  /** The user's other bots: the prompt tells this bot where their (readable) files are. */
  peers?: Array<{ id: string; name: string }>;
  /** Must be a catalog id; the route rejects anything else. */
  modelId?: string;
  reasoningEffort?: string;
  /** Required: OpenRouter is the only model provider. */
  openrouterApiKey?: string;
  /** Hard cap on tokens per model reply. Without it OpenRouter reserves credit for the model maximum (64k+). */
  maxOutputTokens?: number;
  /** Web search is offered only when a key is configured. */
  tavilyApiKey?: string;
  checkpointer: BaseCheckpointSaver;
  /** Present when this run may use the user's shared computer. */
  computer?: { stub: ComputerStub; runId: string };
  /** Present when file storage is configured: image creation, view_image, and (with a computer) copy/share. */
  files?: Omit<FileToolsOptions, "botId" | "openrouterApiKey" | "vision" | "view" | "computer"> & {
    /** Images the user attached to this message: the model sees them (vision models only). */
    attached?: ViewHolder["images"];
  };
  /** The bot's installed skills as files ("/<folder>/SKILL.md", ...), from lib/skills.ts. */
  skills?: Record<string, string>;
  /** Tools of the bot's connected apps (MCP servers) and the ones that need approval, from agent/mcp.ts. */
  apps?: Pick<BotApps, "tools" | "approvals" | "names" | "unavailable" | "readOnly" | "close">;
  /** What a sub-agent group may use and how to account for it; required for the sub-agent tools (bots with the capability). */
  subagents?: Pick<
    SubagentToolsOptions,
    "env" | "db" | "userId" | "threadId" | "runId" | "installedSkills" | "connectedApps" | "report" | "hub" | "sliceDeadline"
  >;
}

/**
 * Human-in-the-loop (Deep Agents `interruptOn`): the run pauses before these tools run and the
 * chat shows Approve / Reject. https://docs.langchain.com/oss/javascript/deepagents/human-in-the-loop
 *
 * Without a computer, file writes go to a virtual filesystem and still ask first. With one, the
 * bot's files live in its own Linux account; what needs the user is waking the shared computer (it costs
 * computer time) and shutting it down while another bot is working (that stops the other bot).
 */
const fileApprovals: Record<string, InterruptOnConfig> = {
  write_file: { allowedDecisions: ["approve", "edit", "reject"] },
  edit_file: { allowedDecisions: ["approve", "edit", "reject"] },
};
// turn_off_computer is not listed: the tool itself asks the user, but only when another bot is working or the user
// holds the mouse (see tools.ts). Turning off an idle computer needs no approval.
const computerApprovals: Record<string, InterruptOnConfig> = {
  turn_on_computer: { allowedDecisions: ["approve", "reject"], description: "Turn on your computer?" },
};

export function buildAgent(options: BuildAgentOptions) {
  const { bot, openrouterApiKey, tavilyApiKey, checkpointer, computer } = options;
  if (!openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured; the agent has no model to call.");
  }

  const model = resolveModel(options.modelId ?? DEFAULT_MODEL_ID);
  if (!model) throw new Error(`Unknown model: ${options.modelId}`);
  const effort =
    model.reasoning && options.reasoningEffort && model.reasoningEfforts.includes(options.reasoningEffort)
      ? options.reasoningEffort
      : undefined;

  // Every model comes from OpenRouter, through LangChain's own OpenRouter integration.
  // `modelKwargs` is merged into the request body, which is where OpenRouter reads `reasoning`.
  const createModel = () =>
    new ChatOpenRouter({
      model: model.id,
      apiKey: openrouterApiKey,
      maxTokens: options.maxOutputTokens ?? 8192,
      siteUrl: "https://k4.bot",
      siteName: "K4 Bot",
      ...(effort ? { modelKwargs: { reasoning: { effort } } } : {}),
    });
  const chatModel = createModel();
  // The role decides the playbook, the web tools and what its sub-agents are told.
  const domain = domainFor(bot.role);
  const today = new Date().toISOString().slice(0, 10);
  const unix = botUnixUser(bot.id);
  const hasSkills = Object.keys(options.skills ?? {}).length > 0;
  // The bot's files: the computer when it has one, otherwise the conversation's own filesystem. Fixed folders on top:
  // Deep Agents' scratch space, its read-only skills, and subagents/ where finished sub-agent groups leave their files.
  const backend = new CompositeBackend(computer && unix.ok ? new ComputerSandbox(computer.stub, bot.id) : new StateBackend(), {
    "/large_tool_results/": new StateBackend(),
    "/conversation_history/": new StateBackend(),
    "/subagents/": new StateBackend(),
    ...(hasSkills ? { [SKILLS_ROOT]: new SkillsBackend(options.skills!) } : {}),
  });

  /**
   * Where a finished sub-agent group's files go: the bot's folder on the computer when it is on; otherwise its
   * /subagents/ folder (only from inside its own tool call, where its state can be written). Null when neither works.
   */
  const saveGroupFiles = async (dir: string, files: Record<string, string>, { workspace }: { workspace: boolean }) => {
    const entries = Object.entries(files);
    if (computer && unix.ok) {
      const base = `${botHome(unix.value)}/${dir}`;
      try {
        const results = await computer.stub.upload(bot.id, entries.map(([path, text]): [string, Uint8Array] => [`${base}/${path}`, new TextEncoder().encode(text)]));
        if (results.every((r) => !r.error)) return `${base}/ on the computer`;
      } catch {
        // The computer is off: keep them in the bot's own files instead.
      }
    }
    if (!workspace) return null;
    try {
      for (const [path, text] of entries) {
        const result = await backend.write(`/${dir}/${path}`, text);
        if (result.error) return null;
      }
      return `/${dir}/ in your files${computer ? " (the computer was off; copy them there if needed)" : ""}`;
    } catch {
      return null;
    }
  };

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
          tavilyApiKey,
          botApps: options.apps as BotApps | undefined,
          saveFiles: saveGroupFiles,
        })
      : [];

  const screen: ScreenHolder = {};
  const computerTools = computer
    ? createComputerTools({ computer: computer.stub, botId: bot.id, runId: computer.runId, screen })
    : [];
  // Without vision the model cannot use the screen, so it is not offered the mouse and keyboard.
  const view: ViewHolder = { images: model.vision ? (options.files?.attached ?? []) : [] };
  const fileTools = options.files
    ? createFileTools({
        ...options.files,
        botId: bot.id,
        openrouterApiKey,
        vision: model.vision,
        view,
        ...(computer && unix.ok ? { computer: { stub: computer.stub, home: botHome(unix.value) } } : {}),
      })
    : [];
  const tools = [
    ...(tavilyApiKey ? createWebTools(tavilyApiKey, domain.web) : []),
    ...subagentTools,
    ...computerTools.filter((t) => model.vision || t.name !== "computer"),
    ...fileTools,
    ...(options.apps?.tools ?? []),
  ];
  const approvals = { ...(computer ? computerApprovals : fileApprovals), ...(options.apps?.approvals ?? {}) };

  return createDeepAgent({
    model: chatModel,
    tools,
    backend,
    // Deep Agents' skills system: names and descriptions in the prompt, the full SKILL.md read on demand.
    ...(hasSkills ? { skills: [SKILLS_ROOT] } : {}),
    middleware: [
      // Outermost: a failed tool call becomes an error message the agent can react to, not a dead run.
      createToolErrorsMiddleware(),
      // Deep Agents' built-in `task` sub-agent is hidden: sub-agents are the spawn_subagents capability, given on purpose.
      createHideToolsMiddleware(["task"]),
      // At most this many tool calls of one step run at the same time; the rest wait their turn.
      createParallelToolsMiddleware(bot.maxParallelTools),
      // While a sub-agent group runs, nothing may pause the run (an approval or a question would end the step and the
      // group with it), and only one group runs at a time.
      ...(options.subagents ? [createGroupGuardMiddleware(options.subagents.hub, [...Object.keys(approvals), "ask_user", "wait_for", "spawn_subagents"])] : []),
      // LangChain's built-in PII guardrails: the model never sees card numbers or key-shaped secrets,
      // whether typed by the user or returned by a web page or the shell.
      piiMiddleware("credit_card", { strategy: "redact", applyToInput: true, applyToToolResults: true }),
      piiMiddleware("api_key", {
        detector: /\b(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,})/,
        strategy: "redact",
        applyToInput: true,
        applyToToolResults: true,
      }),
      ...(computer ? [createScreenMiddleware(screen, computer.stub, bot.id)] : []),
      ...(model.vision && options.files ? [createViewMiddleware(view)] : []),
    ],
    systemPrompt: systemPrompt({
      bot,
      files: options.files ? { canSee: model.vision } : undefined,
      skills: hasSkills ? { onComputer: Boolean(computer && unix.ok) } : undefined,
      apps: options.apps?.names.length ? { names: options.apps.names, unavailable: options.apps.unavailable } : undefined,
      capabilities: { maxParallelTools: bot.maxParallelTools, maxSubagents: subagentTools.length ? bot.maxSubagents : undefined },
      today,
      computer:
        computer && unix.ok
          ? {
              home: botHome(unix.value),
              canSee: model.vision,
              peers: (options.peers ?? []).flatMap((p) => {
                const u = botUnixUser(p.id);
                return u.ok ? [{ name: p.name, home: botHome(u.value) }] : [];
              }),
            }
          : undefined,
    }),
    // Connected-app tools that change the user's data (e.g. Airtable record updates) ask first, like waking the computer.
    interruptOn: approvals,
    checkpointer,
  });
}
