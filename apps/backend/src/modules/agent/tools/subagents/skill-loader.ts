import { loadSkillFiles } from "../../../integrations/skills";
import type { SubagentToolsOptions } from "./options";
import type { AgentSpec } from "./start";

/** The skill files for a member, loaded once per distinct set of skills in a group. */
export function createSkillLoader(o: SubagentToolsOptions) {
  const skillCache = new Map<string, Record<string, string>>();
  return async (a: AgentSpec) => {
    const chosen = o.installedSkills.filter((s) => a.skills?.includes(s.name));
    const key = chosen.map((s) => s.storageKey).sort().join("|");
    let skills = skillCache.get(key);
    if (!skills) {
      skills = chosen.length && o.env.FILES ? await loadSkillFiles(o.env.FILES, chosen) : {};
      skillCache.set(key, skills);
    }
    return skills;
  };
}
