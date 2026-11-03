/**
 * What a bot is for. The role is chosen when the bot is created (and can be changed). What each role does at run
 * time (its playbook, tools and defaults) lives in modules/agent/domains/.
 * The web app lists the same ids in apps/web/src/features/bots/roles.ts (labels, descriptions, icons): keep them in sync.
 */
export const ROLE_IDS = ["assistant", "advisor", "coding", "research", "writing", "custom"] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export const DEFAULT_ROLE: RoleId = "assistant";

/** Longest custom role title. */
export const MAX_ROLE_TITLE = 60;

/** A custom title is user input: one short line, so it cannot add prompt lines. */
export const cleanRoleTitle = (value: string | null | undefined) =>
  (value ?? "").replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_ROLE_TITLE);
