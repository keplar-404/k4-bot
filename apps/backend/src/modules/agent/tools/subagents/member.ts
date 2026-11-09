import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { CompositeBackend, createFilesystemMiddleware, createSkillsMiddleware, StateBackend } from "deepagents";
import { createAgent, type AgentMiddleware } from "langchain";
import { createParallelToolsMiddleware } from "../../middleware/parallel-tools";
import { createToolErrorsMiddleware } from "../../middleware/tool-errors";
import { SKILLS_ROOT, SkillsBackend } from "../../skills-backend";
import { subagentPrompt } from "../../../../prompts/subagent";
import type { Group } from "./group";
import { createActivityMiddleware } from "./activity";
import { fileText, textOf } from "./member-text";
import { createInboxMiddleware, groupTools } from "./group-tools";
import { SHARED_ROOT, SharedFolderBackend } from "./shared-folder";

/** Graph steps one sub-agent may take (each model call or tool round is a step or two). */
const MEMBER_STEPS = 60;



export interface MemberSpec {
  name: string;
  task: string;
  context?: string;
}

export interface MemberSetup {
  group: Group;
  botName: string;
  today: string;
  brief?: string;
  model: BaseChatModel;
  tools: StructuredToolInterface[];
  skills: Record<string, string>;
  maxParallelTools: number;
  timeoutMs: number;
  /** Called on each model and tool call: what the member is doing now. */
  onActivity?: (text: string) => void;
}

/**
 * Runs one member of a group to the end. Its context: the shared goal, its own task and background. Its files:
 * its own scratch space (kept when it finishes), the group's /shared/ folder, and read-only skills.
 */
export async function runMember(spec: MemberSpec, setup: MemberSetup): Promise<{ report: string; files: Record<string, string>; usage: { input: number; output: number } }> {
  const { group } = setup;
  const hasSkills = Object.keys(setup.skills).length > 0;
  const backend = new CompositeBackend(new StateBackend(), {
    [SHARED_ROOT]: new SharedFolderBackend(group.shared),
    ...(hasSkills ? { [SKILLS_ROOT]: new SkillsBackend(setup.skills) } : {}),
  });
  const middleware: AgentMiddleware[] = [
    createToolErrorsMiddleware(),
    createParallelToolsMiddleware(setup.maxParallelTools),
    createInboxMiddleware(group, spec.name),
    ...(setup.onActivity ? [createActivityMiddleware(setup.onActivity)] : []),
    createFilesystemMiddleware({ backend }),
    ...(hasSkills ? [createSkillsMiddleware({ backend, sources: [SKILLS_ROOT] })] : []),
  ];
  const agent = createAgent({
    model: setup.model,
    tools: [...setup.tools, ...groupTools(group, spec.name)],
    middleware,
    systemPrompt: subagentPrompt({
      name: spec.name,
      botName: setup.botName,
      groupId: group.id,
      teammates: group.names.filter((n) => n !== spec.name),
      today: setup.today,
      brief: setup.brief,
      sharedRoot: SHARED_ROOT,
      goal: group.goal,
      context: spec.context,
    }),
  });
  const result = (await agent.invoke(
    { messages: [{ role: "user", content: spec.task }] },
    { recursionLimit: MEMBER_STEPS, signal: AbortSignal.timeout(setup.timeoutMs) },
  )) as { messages: Array<{ usage_metadata?: { input_tokens?: number; output_tokens?: number } }>; files?: Record<string, unknown> };

  const usage = { input: 0, output: 0 };
  for (const m of result.messages) {
    usage.input += m.usage_metadata?.input_tokens ?? 0;
    usage.output += m.usage_metadata?.output_tokens ?? 0;
  }
  const files: Record<string, string> = {};
  for (const [path, data] of Object.entries(result.files ?? {})) {
    const rel = path.replace(/^\/+/, "");
    if (rel && !rel.includes("..")) files[rel] = fileText(data);
  }
  return { report: textOf(result.messages.at(-1)).trim() || "(no answer)", files, usage };
}
