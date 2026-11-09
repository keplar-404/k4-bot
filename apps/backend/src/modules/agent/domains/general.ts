import { cleanRoleTitle } from "../../bots/roles";
import { ROLE_PROMPTS } from "../../../prompts/roles";
import type { DomainSpec } from "./types";

/*
 * The everyday domains. Each is a playbook plus defaults; none needs extra tools. A domain that grows its own
 * prompts or tools moves to a folder like research/.
 */

const standard = { subagents: false, maxSubagents: 5, maxParallelTools: 5 };

export const assistant: DomainSpec = {
  id: "assistant",
  instructions: () => ROLE_PROMPTS.assistant,
  defaults: standard,
  recommended: { skills: ["anthropics/skills/pdf", "anthropics/skills/docx", "anthropics/skills/xlsx", "anthropics/skills/pptx"], apps: ["airtable"] },
};

export const advisor: DomainSpec = {
  id: "advisor",
  instructions: () => ROLE_PROMPTS.advisor,
  defaults: standard,
  recommended: { skills: ["anthropics/knowledge-work-plugins/product-brainstorming", "obra/superpowers/brainstorming"], apps: ["airtable"] },
};


export const writing: DomainSpec = {
  id: "writing",
  instructions: () => ROLE_PROMPTS.writing,
  defaults: standard,
  recommended: { skills: ["coreyhaines31/marketingskills/copywriting", "hardikpandya/stop-slop/stop-slop"], apps: [] },
};

export const custom: DomainSpec = {
  id: "custom",
  instructions: ({ roleTitle }) => {
    const title = cleanRoleTitle(roleTitle);
    return title
      ? ROLE_PROMPTS.custom(title)
      : assistant.instructions({ roleTitle: null });
  },
  defaults: standard,
  recommended: { skills: [], apps: [] },
};
