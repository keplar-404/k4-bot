import { CompositeBackend, StateBackend } from "deepagents";
import { ComputerSandbox, type ComputerStub } from "../computer/sandbox-backend";
import { SKILLS_ROOT, SkillsBackend } from "./skills-backend";

/**
 * The bot's files: the computer when it has one (`home` set), otherwise the conversation's own filesystem. Fixed
 * folders on top: Deep Agents' scratch space, its read-only skills, and subagents/ where finished sub-agent groups
 * leave their files.
 */
export function createWorkspace(options: { botId: string; computer?: ComputerStub; home?: string; skills?: Record<string, string> }) {
  const { botId, computer, home, skills } = options;
  const hasSkills = Object.keys(skills ?? {}).length > 0;
  const backend = new CompositeBackend(computer && home ? new ComputerSandbox(computer, botId) : new StateBackend(), {
    "/large_tool_results/": new StateBackend(),
    "/conversation_history/": new StateBackend(),
    "/subagents/": new StateBackend(),
    ...(hasSkills ? { [SKILLS_ROOT]: new SkillsBackend(skills!) } : {}),
  });

  /**
   * Where a finished sub-agent group's files go: the bot's folder on the computer when it is on; otherwise its
   * /subagents/ folder (only from inside its own tool call, where its state can be written). Null when neither works.
   */
  const saveGroupFiles = async (dir: string, files: Record<string, string>, { workspace }: { workspace: boolean }) => {
    const entries = Object.entries(files);
    if (computer && home) {
      const base = `${home}/${dir}`;
      try {
        const results = await computer.upload(botId, entries.map(([path, text]): [string, Uint8Array] => [`${base}/${path}`, new TextEncoder().encode(text)]));
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

  return { backend, hasSkills, saveGroupFiles };
}
