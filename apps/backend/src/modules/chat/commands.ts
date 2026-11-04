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

/** What the agent is told in a /deep-research run: hand the question to Tavily's research agent, then deliver the report. */
export function researchInstruction(question: string): string {
  return [
    "[The user ran /deep-research.] Call tavily_research exactly once with this research request, keeping every detail and limit the user gave:",
    question,
    "Pick model 'mini' for a narrow, well-scoped question and 'pro' for a broad or multi-part one.",
    "When it returns, give the user the report as it came, with its Sources list. Do not run other searches.",
    "If it says NOT DONE, tell the user why in one or two sentences.",
  ].join("\n\n");
}
