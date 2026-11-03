import { StateBackend } from "deepagents";

/** Where the agent finds its skills. The skills middleware lists every folder here that holds a SKILL.md. */
export const SKILLS_ROOT = "/skills/";

const READ_ONLY = "Skills are read-only. Copy what you need into your own workspace first.";

/**
 * A bot's installed skills as a read-only folder, for Deep Agents' skills system (progressive disclosure: the
 * model sees each skill's name and description, and reads the full SKILL.md only when it needs it).
 *
 * Built on StateBackend in its injected-state mode, over a fixed map of files loaded from storage for this run: it
 * reuses Deep Agents' own listing, paging, glob and grep, and nothing is written to the conversation's checkpoint
 * (skills can be a few MB). Every write is refused, so a bot cannot change a skill.
 */
export class SkillsBackend extends StateBackend {
  constructor(files: Record<string, string>) {
    const now = new Date().toISOString();
    super({
      state: {
        files: Object.fromEntries(
          Object.entries(files).map(([path, content]) => [path, { content, mimeType: "text/plain", created_at: now, modified_at: now }]),
        ),
      },
    } as unknown as ConstructorParameters<typeof StateBackend>[0]);
  }

  override write() {
    return { error: READ_ONLY };
  }

  override edit() {
    return { error: READ_ONLY };
  }

  override delete() {
    return { error: READ_ONLY };
  }

  override uploadFiles(files: Array<[string, Uint8Array]>) {
    return files.map(([path]) => ({ path, error: "permission_denied" as const }));
  }
}
