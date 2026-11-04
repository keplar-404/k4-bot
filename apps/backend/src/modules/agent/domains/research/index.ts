import type { DomainSpec } from "../types";
import { RESEARCH_INSTRUCTIONS, RESEARCHER_BRIEF } from "./prompts";

/**
 * Deep research bot: a lead that scopes the question, researches with the full web toolset, and for broad
 * questions spawns a group of researcher sub-agents (one per subtopic, in parallel), then writes the cited report.
 */
export const research: DomainSpec = {
  id: "research",
  instructions: () => RESEARCH_INSTRUCTIONS,
  // Parallel by default: the playbook relies on batched searches and sub-agents for broad questions.
  defaults: { subagents: true, maxSubagents: 6, maxParallelTools: 10 },
  recommended: {
    skills: [
      "tavily-ai/skills/tavily-research",
      "tavily-ai/skills/tavily-search",
      "anthropics/knowledge-work-plugins/knowledge-synthesis",
      "affaan-m/ecc/literature-review",
    ],
    apps: ["airtable"],
  },
  subagentBrief: RESEARCHER_BRIEF,
};
