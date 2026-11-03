import { Sandbox } from "@e2b/desktop";
import type { WorkingBot } from "../types";
import { type Closed, CLOSED_TTL_MS, MAX_SNAPSHOT_BYTES, MIN_WAKE_SECONDS, TICK_MS, WRAP_TICK_MS } from "./constants";
import { ComputerStatusLayer } from "./status";
import { closedText, offText, STARTING_TEXT, USED_UP_TEXT } from "./texts";

/** Putting the computer to sleep, scheduling its alarm, and what bots are told while it is off. */
export class ComputerSleep extends ComputerStatusLayer {
  /**
   * Pause keeps disk and memory and stops billing. Safe to call when already paused.
   * The screen is saved first, so the asleep preview shows where things were left.
   */
  async pause(reason = "Asleep. Your work is saved."): Promise<void> {
    this.pausing = true;
    try {
      await this.sleepNow(reason);
    } finally {
      this.pausing = false;
    }
  }

  private async sleepNow(reason: string) {
    const sbx = this.sbx;
    this.sbx = undefined;
    this.lease = null;
    this.vncFor = undefined;
    this.sessionEndsAt = 0;
    this.warned = false;
    this.wrapping = false;
    if (sbx) {
      const png = await sbx.screenshot().catch(() => undefined);
      if (png && png.byteLength <= MAX_SNAPSHOT_BYTES) {
        this.snapshotAt = Date.now();
        await this.ctx.storage.put("snapshot", { at: this.snapshotAt, png });
      }
    }
    // After an eviction there is no sandbox object, but the id is enough to pause it.
    const id = sbx?.sandboxId ?? (await this.ctx.storage.get<string>("sandboxId"));
    if (id) await Sandbox.pause(id, { apiKey: this.cfg.E2B_API_KEY }).catch(() => undefined);
    if (this.state === "running" || this.state === "starting") await this.setState("paused", reason);
  }

  /** Next alarm: the regular tick (faster while wrapping up), or sooner when the warning or the end is due. */
  protected async scheduleAlarm() {
    const now = Date.now();
    const end = (await this.endsAt()).at;
    const warnAt = end - this.wrapMs;
    const due = [now + (this.wrapping ? WRAP_TICK_MS : TICK_MS), end, warnAt > now ? warnAt : Number.POSITIVE_INFINITY];
    await this.ctx.storage.setAlarm(Math.max(now + 1000, Math.min(...due)));
  }

  protected async rememberClosed(cause: Closed["cause"], bots: WorkingBot[]) {
    if (bots.length === 0) return;
    await this.ctx.storage.put("closed", {
      cause,
      at: Date.now(),
      bots: Object.fromEntries(bots.map((b) => [b.botId, { name: b.name, told: false }])),
    } satisfies Closed);
  }

  /** The record of a shutdown that hit this bot, if it is recent. */
  protected async closedFor(botId?: string): Promise<Closed | null> {
    if (!botId) return null;
    const closed = await this.ctx.storage.get<Closed>("closed");
    return closed && Date.now() - closed.at < CLOSED_TTL_MS && closed.bots[botId] ? closed : null;
  }

  /** What a bot is told when the computer is not on. */
  protected async offMessage(botId?: string): Promise<string> {
    if (this.state === "starting") return STARTING_TEXT;
    const closed = await this.closedFor(botId);
    if (closed) return closedText(closed.cause);
    if (this.cfg.COMPUTER_MAX_MINUTES_PER_DAY * 60 - (await this.usedSeconds()) < MIN_WAKE_SECONDS) return USED_UP_TEXT;
    return offText(this.message);
  }
}
