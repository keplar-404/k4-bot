import type { RoleId } from "@/features/bots/roles";

export type SkillRole = Exclude<RoleId, "custom">;

export interface CatalogSkill {
  id: string;
  name: string;
  role: SkillRole;
  summary: string;
  /** The user's install of it, if any. */
  installedId: string | null;
}

export interface InstalledSkill {
  id: string;
  skillId: string;
  name: string;
  title: string;
  description: string;
  role: SkillRole | null;
  installedAt: string;
}

export interface SkillDetails {
  id: string;
  name: string;
  role: SkillRole;
  summary: string;
  description: string;
  source: string;
  url: string;
  skillMd: string;
  files: Array<{ path: string; size: number }>;
}

export interface McpField {
  key: string;
  label: string;
  placeholder?: string;
  help: string;
  helpUrl?: string;
}

export interface CatalogMcp {
  id: string;
  name: string;
  publisher: string;
  roles: string[];
  summary: string;
  description: string;
  capabilities: string[];
  website: string;
  docsUrl: string;
  kind: "remote" | "builtin";
  fields: McpField[];
  connectedId: string | null;
}

export interface InstalledMcp {
  id: string;
  serverId: string;
  name: string;
  summary: string;
  kind: "remote" | "builtin";
  /** Last characters of the saved token (the token itself never comes back). */
  secretHint: string | null;
  needsSecrets: boolean;
  updatedAt: string;
}
