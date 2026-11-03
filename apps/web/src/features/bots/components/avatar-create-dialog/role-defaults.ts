import type { Capabilities } from "@/features/bots/components/bot-capabilities";
import type { RoleId } from "@/features/bots/roles";

export interface RoleDefaultsContext {
  domains: {
    id: string;
    defaults: {
      subagents: boolean;
      maxSubagents: number;
      maxParallelTools: number;
    };
    recommended: { skills: string[]; apps: string[] };
  }[];
  capsTouched: boolean;
  picksTouched: boolean;
  isEditing: boolean;
  installedSkills:
    | { installed?: { skillId: string; id: string }[] }
    | null
    | undefined;
  installedApps:
    | { installed?: { serverId: string; id: string }[] }
    | null
    | undefined;
  setCaps: (c: Capabilities) => void;
  setSkillIds: (ids: string[]) => void;
  setMcpServerIds: (ids: string[]) => void;
}

export function applyRoleDefaultsImpl(
  next: RoleId,
  ctx: RoleDefaultsContext,
): void {
  const domain = ctx.domains.find((d) => d.id === next);
  if (!domain) return;
  if (!ctx.capsTouched)
    ctx.setCaps({
      subagentsEnabled: domain.defaults.subagents,
      maxSubagents: domain.defaults.maxSubagents,
      maxParallelTools: domain.defaults.maxParallelTools,
    });
  if (!ctx.isEditing && !ctx.picksTouched) {
    ctx.setSkillIds(
      (ctx.installedSkills?.installed ?? [])
        .filter((s) => domain.recommended.skills.includes(s.skillId))
        .map((s) => s.id),
    );
    ctx.setMcpServerIds(
      (ctx.installedApps?.installed ?? [])
        .filter((a) => domain.recommended.apps.includes(a.serverId))
        .map((a) => a.id),
    );
  }
}
