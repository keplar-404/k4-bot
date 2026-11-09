/** What the agent is told in a /deep-research run: hand the question to Tavily's research agent, then deliver the report. */
export function researchInstruction(question: string): string {
  return [
    "[The user ran /deep-research.] Call tavily_research exactly once with this research request, keeping every detail and limit the user gave:",
    question,
    "Pick model 'mini' for a narrow, well-scoped question and 'pro' for a broad or multi-part one.",
    "When it returns, give the user the report as it came, with its Sources list. Do not run other searches.",
    "If the report says it continues in a file, give what you received and tell the user the full report is in the attached file.",
    "If it says NOT DONE, tell the user why in one or two sentences.",
  ].join("\n\n");
}

/** The turn after /compact: the agent confirms the summary. */
export const COMPACT_CONFIRM =
  "[The user ran /compact: the conversation so far was summarized to free context.] Reply in one or two short sentences: confirm it, and say in a few words what you still remember.";
