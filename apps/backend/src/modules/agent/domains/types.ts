import type { RoleId } from "../../bots/roles";
import type { WebLevel } from "../tools/web";

/** Hard ceilings on the bot capabilities, whatever a bot is set to. */
export const MAX_SUBAGENTS = 20;
export const MAX_PARALLEL_TOOLS = 10;

/**
 * A domain is what a bot's role means at run time: how it works (its playbook), which tools and capabilities it
 * gets, and the defaults a new bot of that role starts with. Every bot is the same agent; the domain only changes
 * this configuration.
 *
 * To add a domain bot: add its role id in modules/bots/roles.ts, write a spec in this folder (a folder of its own when it
 * has several prompts, like research/), register it in domains/index.ts, and add its label in the web app's
 * modules/bots/roles.ts. Nothing else needs to know about it.
 */
export interface DomainSpec {
  id: RoleId;
  /** The role section of the system prompt: who the bot is in this domain and how it works. Kept short: it is sent every step. */
  instructions(bot: { roleTitle: string | null }): string;
  /** Which web tools it gets. */
  web: WebLevel;
  /** A new bot of this role starts with these; the user can change them in the bot form. */
  defaults: DomainDefaults;
  /** Catalog ids the bot form suggests first for this role. */
  recommended: { skills: string[]; apps: string[] };
  /** How this domain briefs each sub-agent it spawns (prepended to the sub-agent's own task). */
  subagentBrief?: string;
}

export interface DomainDefaults {
  /** May the bot spawn groups of sub-agents? */
  subagents: boolean;
  /** At most this many sub-agents per group (1-20). */
  maxSubagents: number;
  /** At most this many tool calls at the same time (1-10). */
  maxParallelTools: number;
}
