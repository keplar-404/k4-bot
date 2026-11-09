/**
 * Chat slash commands the server acts on. The message is stored as typed; the run reads its meaning from here, so a
 * client cannot start a paid research task with a flag alone.
 */
export const DEEP_RESEARCH = "/deep-research";

/** The question after /deep-research, "" when the command has none, or null when this is not a research message. */
export function deepResearchQuestion(content: string): string | null {
  const text = content.trim();
  if (text !== DEEP_RESEARCH && !text.startsWith(`${DEEP_RESEARCH} `) && !text.startsWith(`${DEEP_RESEARCH}\n`)) return null;
  return text.slice(DEEP_RESEARCH.length).trim();
}

export { researchInstruction } from "../../prompts/commands";
