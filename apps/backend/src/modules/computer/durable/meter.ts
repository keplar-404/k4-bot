import { EXTEND_WHEN_BELOW_MS, SESSION_MS, TICK_MS, today } from "./constants";
import { ComputerSession } from "./session";

/** The alarm: the budget guard and idle watch while the computer is awake (and the sign-up provisioning). */
export class ComputerMeter extends ComputerSession {
  /**
   * Runs every 30s while the computer is awake: counts the minutes used (the
   * budget guard), pauses it when idle, and keeps E2B's own timeout ahead of
   * real activity without calling E2B on every action.
   */
  override async alarm() {
    if (await this.ctx.storage.get<boolean>("provision")) await this.runProvisioning();
    if (this.state !== "running") return;
    const now = Date.now();
    const usage = await this.ctx.storage.get<{ day: string; seconds: number }>("usage");
    const base = usage?.day === today() ? usage.seconds : 0;
    const seconds = base + Math.min(now - this.lastTick, 2 * TICK_MS) / 1000;
    this.lastTick = now;
    await this.ctx.storage.put("usage", { day: today(), seconds });

    const userInControl = this.holder()?.kind === "user";
    const idleMs = this.cfg.COMPUTER_IDLE_MINUTES * 60_000;

    if (seconds >= this.cfg.COMPUTER_MAX_MINUTES_PER_DAY * 60) {
      await this.rememberClosed("quota", this.working());
      await this.pause("Daily computer time limit reached.");
    } else if (this.sessionEndsAt && now >= this.sessionEndsAt) {
      const wrapped = this.wrapping;
      await this.rememberClosed("session", this.working());
      await this.pause(wrapped ? "Wrapped up. Your work is saved." : `The ${this.cfg.COMPUTER_SESSION_MINUTES}-minute session ended. Your work is saved.`);
    } else if (this.wrapping && this.working().length === 0) {
      await this.pause("Wrapped up. Your work is saved.");
    } else if (!userInControl && now - this.lastActivity > idleMs) {
      await this.pause("Paused after being idle. Your work is saved.");
    } else {
      await this.keepAwake(now);
    }
  }

  private async keepAwake(now: number) {
    // The end is near (the session's or today's computer time): the user is asked, in the chat, to wrap up or stop now.
    if (!this.warned && (await this.endsAt()).at - now <= this.wrapMs) {
      this.warned = true;
    }
    if (this.sbx && this.expiresAt - now < EXTEND_WHEN_BELOW_MS) {
      await this.sbx.setTimeout(SESSION_MS).catch(() => undefined);
      this.expiresAt = now + SESSION_MS;
    }
    await this.persist();
    await this.publishStatus();
    await this.scheduleAlarm();
  }
}
