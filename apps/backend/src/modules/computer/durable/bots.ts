import { CommandExitError, type Sandbox } from "@e2b/desktop";
import { botUnixUser } from "../guards";
import type { ExecResult } from "../types";
import { ensureAccount, runAs } from "./accounts";
import { cap, ComputerOffError, MAX_OUTPUT_CHARS, MAX_PARALLEL_EXEC } from "./constants";
import { ComputerControl } from "./control";
import { downloadAs, uploadAs } from "./file-io";

/** The bots' own work: each in its own Linux account, with a shell, files, and lines in the Activity feed. */
export class ComputerBots extends ComputerControl {
  /**
   * The bot's own Linux account (see ensureAccount). Re-applied once per Durable Object lifetime, which also
   * upgrades homes created before the current rules.
   */
  protected async botUser(sbx: Sandbox, botId: string): Promise<string> {
    if (this.tables.isRemoved(botId)) throw new ComputerOffError("This bot was deleted.");
    // Every shell, file and screen action of a bot passes here: this is what makes it "using the computer".
    this.markWorking(botId);
    const checked = botUnixUser(botId);
    if (!checked.ok) throw new Error(checked.reason);
    const user = checked.value;
    if (!this.botUsers.has(user)) {
      await ensureAccount(sbx, user);
      this.botUsers.add(user);
      this.directoryDirty = true;
    }
    if (this.directoryDirty) await this.writeDirectory(sbx).catch((e) => console.error("[computer] directory", e));
    return user;
  }

  /** Records the bot's display name for /home/BOTS.md. Storage only: never touches E2B. */
  async registerBot(botId: string, name: string): Promise<void> {
    if (this.tables.isRemoved(botId)) return;
    if (this.tables.nameBot(botId, name)) this.directoryDirty = true;
  }

  /**
   * A bot was deleted: it can never use the computer again (a run still in flight is refused at once),
   * and its account and files are removed now if the computer is awake, or on its next wake otherwise.
   * The computer is never woken just to delete.
   */
  async removeBot(botId: string): Promise<void> {
    this.tables.removeBot(botId);
    this.directoryDirty = true;
    await this.releaseBot(botId);
    if (this.state === "running" && this.sbx) await this.purgeRemovedBots(this.sbx);
  }

  /** Shell for the file tools and the `execute` tool. Runs as the bot's own Linux user. */
  async exec(botId: string, command: string, timeoutMs?: number): Promise<ExecResult> {
    if (command.length > 20_000) return { output: "Command too long.", exitCode: 2, truncated: false };
    if (this.execInFlight >= MAX_PARALLEL_EXEC) {
      return { output: "Too many commands are running at once. Wait for one to finish and retry.", exitCode: 75, truncated: false };
    }
    this.execInFlight++;
    try {
      return await this.withSandbox(botId, async (sbx) => {
        const user = await this.botUser(sbx, botId);
        this.touch();
        try {
          const r = await runAs(sbx, user, command, Math.min(timeoutMs ?? 120_000, 600_000));
          const output = r.stdout + r.stderr;
          return { output: cap(output), exitCode: r.exitCode ?? 0, truncated: output.length > MAX_OUTPUT_CHARS };
        } catch (error) {
          // Cut off because the computer is going to sleep: let withSandbox say why (not "timed out").
          if (this.state !== "running" || this.pausing) throw error;
          if (error instanceof CommandExitError) {
            const output = error.stdout + error.stderr;
            return { output: cap(output), exitCode: error.exitCode, truncated: output.length > MAX_OUTPUT_CHARS };
          }
          if (/timeout|timed out/i.test(String(error))) return { output: "Command timed out.", exitCode: 124, truncated: false };
          throw error;
        }
      });
    } finally {
      this.execInFlight--;
    }
  }

  async upload(botId: string, files: Array<[string, Uint8Array]>): Promise<Array<{ path: string; error: string | null }>> {
    return this.withSandbox(botId, async (sbx) => uploadAs(sbx, await this.botUser(sbx, botId), files));
  }

  async download(botId: string, paths: string[]): Promise<Array<{ path: string; content: Uint8Array | null; error: string | null }>> {
    return this.withSandbox(botId, async (sbx) => downloadAs(sbx, await this.botUser(sbx, botId), paths));
  }
}
