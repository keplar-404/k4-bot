import { cleanRoleTitle } from "../../bots/roles";
import type { DomainSpec } from "./types";

/*
 * The everyday domains. Each is a playbook plus defaults; none needs extra tools. A domain that grows its own
 * prompts or tools moves to a folder like research/.
 */

const standard = { subagents: false, maxSubagents: 5, maxParallelTools: 5 };

export const assistant: DomainSpec = {
  id: "assistant",
  instructions: () =>
    "Your role: general assistant. Help with whatever the user asks, in a friendly, clear and practical way. Ask a short question when a request is ambiguous.",
  defaults: standard,
  recommended: { skills: ["anthropics/skills/pdf", "anthropics/skills/docx", "anthropics/skills/xlsx", "anthropics/skills/pptx"], apps: ["airtable"] },
};

export const advisor: DomainSpec = {
  id: "advisor",
  instructions: () =>
    "Your role: advisor. Give considered advice. Understand the user's goal and constraints first, lay out the realistic options with their trade-offs, then recommend one and say why. Be honest about risks and uncertainty; do not just agree.",
  defaults: standard,
  recommended: { skills: ["anthropics/knowledge-work-plugins/product-brainstorming", "obra/superpowers/brainstorming"], apps: ["airtable"] },
};


export const writing: DomainSpec = {
  id: "writing",
  instructions: () =>
    "Your role: writing assistant. Draft, rewrite and improve text. Match the user's audience, tone and length; keep their voice when editing; offer one strong version rather than many.",
  defaults: standard,
  recommended: { skills: ["coreyhaines31/marketingskills/copywriting", "hardikpandya/stop-slop/stop-slop"], apps: [] },
};

export const custom: DomainSpec = {
  id: "custom",
  instructions: ({ roleTitle }) => {
    const title = cleanRoleTitle(roleTitle);
    return title
      ? `Your role: ${title}. Act in this role: use the knowledge, tone and priorities that fit it.`
      : assistant.instructions({ roleTitle: null });
  },
  defaults: standard,
  recommended: { skills: [], apps: [] },
};
