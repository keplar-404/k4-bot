import { StateBackend } from "deepagents";
import type { SubagentStatus } from "../../parts";

/** The lead (main bot) as a message sender or recipient. */
export const LEAD = "lead";
const MAX_MESSAGE_CHARS = 8_000;
const MAX_MESSAGES = 500;

export type GroupMessage = { from: string; to: string; text: string; question?: boolean };

/**
 * A sub-agent group while it runs: its members' status, a mailbox per member and for the lead, a shared folder,
 * and their results. It lives in memory for the run segment that started it, and is removed once the lead has
 * its results; only the saved files and the reports outlive it.
 */
export class Group {
  readonly statuses: SubagentStatus[];
  readonly reports: string[];
  /** Each member's own files when it finished: name -> relative path -> text. */
  readonly memberFiles = new Map<string, Record<string, string>>();
  /** The shared folder, mounted at /shared/ for every member (see SharedFolderBackend). */
  readonly shared: Record<string, { content: string; mimeType: string; created_at: string; modified_at: string }> = {};
  done = false;
  finished: Promise<void> = Promise.resolve();
  /** The lead's tool call currently waiting on the group: the chat shows the live status under it. */
  watcher = "";
  private readonly inbox = new Map<string, GroupMessage[]>();
  private readonly wakers = new Map<string, Set<() => void>>();
  private sent = 0;

  constructor(
    readonly id: string,
    readonly goal: string,
    readonly names: string[],
  ) {
    this.statuses = names.map((name) => ({ name, status: "queued" }));
    this.reports = names.map(() => "");
  }

  /** Sends a message; "all" reaches every other member. Returns an error for the sender, or null. */
  post(from: string, to: string, text: string, question = false): string | null {
    if (this.done) return "The group has finished.";
    if (this.sent >= MAX_MESSAGES) return "This group has sent too many messages.";
    const recipients = to === "all" ? this.names.filter((n) => n !== from) : [to];
    if (recipients.some((r) => r !== LEAD && !this.names.includes(r))) return `No member "${to}". Members: ${this.names.join(", ")}, or "lead".`;
    const body = text.length > MAX_MESSAGE_CHARS ? `${text.slice(0, MAX_MESSAGE_CHARS)}\n…[clipped: put long data in /shared/ instead]` : text;
    for (const r of recipients) {
      const queue = this.inbox.get(r) ?? [];
      queue.push({ from, to: r, text: body, question });
      this.inbox.set(r, queue);
      this.wake(r);
    }
    this.sent++;
    return null;
  }

  /** Removes and returns the recipient's unread messages. */
  take(recipient: string): GroupMessage[] {
    const queue = this.inbox.get(recipient) ?? [];
    this.inbox.set(recipient, []);
    return queue;
  }

  /** Removes and returns the first unread message from `from` to `recipient`, leaving the others. */
  takeFrom(recipient: string, from: string): GroupMessage | undefined {
    const queue = this.inbox.get(recipient) ?? [];
    const at = queue.findIndex((m) => m.from === from);
    return at < 0 ? undefined : queue.splice(at, 1)[0];
  }

  hasMail(recipient: string) {
    return (this.inbox.get(recipient)?.length ?? 0) > 0;
  }

  /** Resolves when the recipient gets mail, the group finishes, or `ms` passes. */
  waitFor(recipient: string, ms: number): Promise<void> {
    if (this.done || this.hasMail(recipient) || ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const set = this.wakers.get(recipient) ?? new Set();
      const wake = () => {
        clearTimeout(timer);
        set.delete(wake);
        resolve();
      };
      const timer = setTimeout(wake, ms);
      set.add(wake);
      this.wakers.set(recipient, set);
    });
  }

  finish() {
    this.done = true;
    for (const set of this.wakers.values()) for (const wake of [...set]) wake();
  }

  private wake(recipient: string) {
    for (const wake of [...(this.wakers.get(recipient) ?? [])]) wake();
  }
}

/** The groups of one run segment (created per slice by the workflow, shared by the lead's tools). */
export class GroupHub {
  readonly groups = new Map<string, Group>();
  /** Set by the lead's tools: saves a finished group's files and returns its results (see tools/subagents). */
  collect?: (group: Group, workspace: boolean) => Promise<string>;
  get running() {
    return [...this.groups.values()].some((g) => !g.done);
  }
}

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
