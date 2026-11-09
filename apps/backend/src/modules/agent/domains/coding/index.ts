import { ROLE_PROMPTS } from "../../../../prompts/roles";
import type { DomainSpec } from "../types";

const codingDefaults = { subagents: true, maxSubagents: 6, maxParallelTools: 6 };

/**
 * The coding bot: every default feature plus its own E2B sandbox (sandbox_* tools), sub-agent groups and background
 * tasks. The playbook is short (it is sent on every step) and follows what makes coding agents reliable: explore
 * first, small checked edits, run the tests, never claim what was not run.
 */
export const coding: DomainSpec = {
  id: "coding",
  instructions: () => ROLE_PROMPTS.coding,
  defaults: codingDefaults,
  recommended: { skills: ["mattpocock/skills/tdd", "obra/superpowers/systematic-debugging", "shadcn-ui/ui/shadcn"], apps: ["shadcn"] },
  subagentBrief: ROLE_PROMPTS.codingSubagent,
};
