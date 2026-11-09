import { Sandbox } from "@e2b/desktop";
import type { ComputerSettings, ComputerSettingsInput, WorkingBot } from "../types";
import type { Closed } from "./constants";
import { ComputerPower } from "./power";
import { killOwnSandboxes } from "./sandbox";
import { closedText, quotaNotice, wrapUpNotice } from "./texts";

/** Ending a session: shutting down on someone's say-so, wrapping up, and what bots are told before the end. */
export class ComputerSession extends ComputerPower {
  /**
   * Shuts the computer down on someone's say-so. While bots are using it that needs `force`: without it nothing
   * happens and the bots are returned, so the caller can ask first (the server is the judge, not a possibly
   * stale screen). Forced, the bots are remembered so each is told it was shut down and writes a final message.
   * `exceptBotId` is the bot that asked for it (it knows).
   */
  async close(options: {
    reason: string;
    cause: Closed["cause"];
    force: boolean;
    exceptBotId?: string;
  }): Promise<{ closed: true } | { closed: false; working: WorkingBot[] }> {
    const busy = this.state === "running" ? this.working(options.exceptBotId) : [];
    if (busy.length > 0 && !options.force) return { closed: false, working: busy };
    await this.rememberClosed(options.cause, busy);
    await this.pause(options.reason);
    return { closed: true };
  }

  /**
   * Wipes the computer: the sandbox is destroyed (every bot's files, accounts and open apps go with it) and the
   * next wake creates a brand-new one. Like `close`, it needs `force` while bots are working and returns them
   * otherwise. Forced, those bots are told it was reset; the route stops their runs.
   */
  async reset(force: boolean): Promise<{ reset: true; stopped: WorkingBot[] } | { reset: false; working: WorkingBot[] }> {
    this.assertEnabled();
    if (this.state === "starting") throw new Error("The computer is starting. Try again in a moment.");
    const busy = this.state === "running" ? this.working() : [];
    if (busy.length > 0 && !force) return { reset: false, working: busy };
    await this.rememberClosed("reset", busy);
    this.pausing = true;
    try {
      const id = this.sbx?.sandboxId ?? (await this.ctx.storage.get<string>("sandboxId"));
      this.sbx = undefined;
      this.lease = null;
      this.vncFor = undefined;
      this.hardenedFor = undefined;
      this.lastDriver = undefined;
      this.sessionEndsAt = 0;
      this.warned = false;
      this.wrapping = false;
      this.botUsers.clear();
      this.marked.clear();
      this.runActions.clear();
      const apiKey = this.cfg.E2B_API_KEY;
      if (id) await Sandbox.kill(id, { apiKey }).catch(() => undefined);
      await killOwnSandboxes(apiKey, this.ctx.id.name);
      await this.ctx.storage.delete(["sandboxId", "snapshot"]);
      this.snapshotAt = undefined;
      this.tables.clearWorkers();
      this.tables.clearActivity();
      // A fresh disk has no accounts left to purge.
      this.tables.markPurged();
      this.directoryDirty = true;
      await this.setState("off", "Setting up a brand-new computer…");
      this.broadcast({ type: "activity-batch", events: [] });
    } finally {
      this.pausing = false;
    }
    return { reset: true, stopped: busy };
  }

  async settings(): Promise<ComputerSettings> {
    const cfg = this.cfg;
    return { ...(await this.limits()), maxIdleMinutes: cfg.COMPUTER_IDLE_MINUTES, maxSessionMinutes: cfg.COMPUTER_SESSION_MINUTES };
  }

  /** Saved for the next tick and the next session; a session already running keeps its end time. */
  async saveSettings(input: ComputerSettingsInput): Promise<ComputerSettings> {
    await this.ctx.storage.put("settings", input);
    return this.settings();
  }

  /** Who is using the computer besides `botId`, and whether the user holds the mouse. For a bot about to turn it off. */
  async shutdownCheck(botId: string): Promise<{ others: string[]; userInControl: boolean }> {
    if (this.state !== "running") return { others: [], userInControl: false };
    return { others: this.working(botId).map((b) => b.name), userInControl: this.holder()?.kind === "user" };
  }

  /** The user chose "Wrap up": bots finish and summarise, and the computer sleeps as soon as none is working (or after COMPUTER_WRAP_MINUTES). */
  async wrapUp(): Promise<void> {
    if (this.state !== "running" || this.wrapping) return;
    if (this.working().length === 0) {
      await this.pause("Wrapped up. Your work is saved.");
      return;
    }
    this.wrapping = true;
    this.warned = true;
    this.sessionEndsAt = Math.min(this.sessionEndsAt || Number.POSITIVE_INFINITY, Date.now() + this.wrapMs);
    await this.persist();
    await this.publishStatus();
    await this.scheduleAlarm();
  }

  /** While wrapping up, the computer goes to sleep the moment the last bot has finished. */
  protected async sleepIfWrapped() {
    if (this.state === "running" && this.wrapping && this.working().length === 0) await this.pause("Wrapped up. Your work is saved.");
  }

  /**
   * What this bot must be told before its next model call, if anything. Read by the agent's middleware, so a
   * bot that is thinking or searching (not touching the computer) still hears it.
   */
  async notice(botId: string): Promise<string | null> {
    const closed = await this.closedFor(botId);
    if (closed) {
      const entry = closed.bots[botId];
      if (entry && !entry.told) {
        entry.told = true;
        await this.ctx.storage.put("closed", closed);
      }
      return closedText(closed.cause);
    }
    if (this.state !== "running") return null;
    const end = await this.endsAt();
    const seconds = Math.max(0, Math.round((end.at - Date.now()) / 1000));
    if (this.wrapping) return wrapUpNotice(seconds);
    if (end.reason === "quota" && end.at - Date.now() <= this.wrapMs) return quotaNotice(seconds);
    return null;
  }
}
