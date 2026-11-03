import { StateBackend } from "deepagents";
import type { Group } from "./group";

export const SHARED_ROOT = "/shared/";

/**
 * The group's shared folder for each member, at /shared/: what one member writes, every other member (and, when the
 * group ends, the lead) can read. Built on StateBackend's injected-state mode over the group's one object; writes
 * change that object directly instead of the member's own state.
 */
export class SharedFolderBackend extends StateBackend {
  constructor(private readonly folder: Group["shared"]) {
    super({ state: { files: folder } } as unknown as ConstructorParameters<typeof StateBackend>[0]);
  }

  override write(filePath: string, content: string) {
    const now = new Date().toISOString();
    this.folder[filePath] = { content, mimeType: "text/plain", created_at: this.folder[filePath]?.created_at ?? now, modified_at: now };
    return { path: filePath, filesUpdate: null };
  }

  override edit(filePath: string, oldString: string, newString: string, replaceAll?: boolean) {
    const file = this.folder[filePath];
    if (!file) return { error: `File '${filePath}' not found` };
    const count = file.content.split(oldString).length - 1;
    if (count === 0) return { error: `String not found in '${filePath}'` };
    if (count > 1 && !replaceAll) return { error: `String appears ${count} times in '${filePath}'; pass replace_all or give more context` };
    file.content = replaceAll ? file.content.split(oldString).join(newString) : file.content.replace(oldString, newString);
    file.modified_at = new Date().toISOString();
    return { path: filePath, filesUpdate: null, occurrences: replaceAll ? count : 1 };
  }

  override delete(filePath: string) {
    delete this.folder[filePath];
    return {};
  }
}
