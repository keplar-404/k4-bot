import type { Group } from "./group";

/** The groups of one run segment (created per slice by the workflow, shared by the lead's tools). */
export class GroupHub {
  readonly groups = new Map<string, Group>();
  /** Set by the lead's tools: saves a finished group's files and returns its results (see tools/subagents). */
  collect?: (group: Group, workspace: boolean) => Promise<string>;
  get running() {
    return [...this.groups.values()].some((g) => !g.done);
  }
}
