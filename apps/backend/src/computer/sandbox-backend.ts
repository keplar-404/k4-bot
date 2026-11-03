import { BaseSandbox } from "deepagents";
import type { Env } from "../lib/env";
import type { UserComputerDurableObject } from "./user-computer";

export type ComputerStub = DurableObjectStub<UserComputerDurableObject>;

/** The user's one computer (a Durable Object named by user id): a user can only ever reach their own. */
export const computerFor = (env: Env, userId: string): ComputerStub => env.USER_COMPUTER.get(env.USER_COMPUTER.idFromName(userId));

type ErrorCode = "file_not_found" | "permission_denied" | "is_directory" | "invalid_path";

/**
 * A bot's view of the user's shared computer, as a Deep Agents sandbox backend.
 *
 * Deep Agents only needs `execute`, `uploadFiles` and `downloadFiles`; the base
 * class builds `ls`, `read_file`, `write_file`, `edit_file`, `glob` and `grep`
 * on top of `execute` (see the "Sandboxes" docs). Every call goes through the
 * user's Durable Object, which runs it as THIS bot's Linux user, so a bot can
 * only touch its own home directory.
 */
export class ComputerSandbox extends BaseSandbox {
  readonly id: string;

  constructor(
    private readonly computer: ComputerStub,
    private readonly botId: string,
  ) {
    super();
    this.id = `computer-${botId}`;
  }

  async execute(command: string) {
    return this.computer.exec(this.botId, command);
  }

  async uploadFiles(files: Array<[string, Uint8Array]>) {
    const results = await this.computer.upload(this.botId, files);
    return results.map((r) => ({ path: r.path, error: r.error as ErrorCode | null }));
  }

  async downloadFiles(paths: string[]) {
    const results = await this.computer.download(this.botId, paths);
    return results.map((r) => ({ path: r.path, content: r.content, error: r.error as ErrorCode | null }));
  }
}
