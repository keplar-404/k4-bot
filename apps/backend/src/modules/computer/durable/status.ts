import type { ComputerSettingsInput, ComputerState as State, ComputerStatus, WorkingBot } from "../types";
import { MIN_WAKE_SECONDS, today } from "./constants";
import { ComputerState } from "./state";

/** What the computer can say about itself without calling E2B: time used, who is working, why it is off. */
export class ComputerStatusLayer extends ComputerState {
  protected get wrapMs() {
    return this.cfg.COMPUTER_WRAP_MINUTES * 60_000;
  }

  /** The user's own idle and session limits; they can only shorten the server's (COMPUTER_IDLE/SESSION_MINUTES). */
  protected async limits(): Promise<{ idleMinutes: number; sessionMinutes: number }> {
    const saved = await this.ctx.storage.get<Partial<ComputerSettingsInput>>("settings");
    const cfg = this.cfg;
    return {
      idleMinutes: Math.min(saved?.idleMinutes ?? cfg.COMPUTER_IDLE_MINUTES, cfg.COMPUTER_IDLE_MINUTES),
      sessionMinutes: Math.min(saved?.sessionMinutes ?? cfg.COMPUTER_SESSION_MINUTES, cfg.COMPUTER_SESSION_MINUTES),
    };
  }

  protected broadcast(message: unknown) {
    const frame = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(frame);
      } catch {
        // a closed socket is cleaned up by webSocketClose
      }
    }
  }

  protected async usedSeconds(): Promise<number> {
    const u = await this.ctx.storage.get<{ day: string; seconds: number }>("usage");
    return u?.day === today() ? u.seconds : 0;
  }

  /**
   * When the computer will go to sleep by itself: the end of this session or the moment today's computer
   * time runs out, whichever comes first. Usage is saved at every tick, so the quota end is exact.
   */
  protected async endsAt(): Promise<{ at: number; reason: "session" | "quota" }> {
    const left = this.cfg.COMPUTER_MAX_MINUTES_PER_DAY * 60 - (await this.usedSeconds());
    const quotaAt = this.lastTick + Math.max(0, left) * 1000;
    const sessionAt = this.sessionEndsAt || Number.POSITIVE_INFINITY;
    return quotaAt <= sessionAt ? { at: quotaAt, reason: "quota" } : { at: sessionAt, reason: "session" };
  }

  /** Bots that used the computer a moment ago and whose run has not ended (`except` leaves one out). */
  protected working(except?: string): WorkingBot[] {
    return this.tables.working(except);
  }

  /** Called on every shell, file or screen action of a bot. Storage only: never touches E2B. */
  protected markWorking(botId: string) {
    const now = Date.now();
    if (now - (this.marked.get(botId) ?? 0) < 15_000) return;
    this.marked.set(botId, now);
    this.tables.touchWorker(botId, now);
  }

  async status(): Promise<ComputerStatus> {
    const now = Date.now();
    const used = await this.usedSeconds();
    const end = this.state === "running" ? await this.endsAt() : null;
    return {
      state: this.state,
      lease: this.holder(),
      minutesUsedToday: Math.round(used / 60),
      minutesLimit: this.cfg.COMPUTER_MAX_MINUTES_PER_DAY,
      limitReached: this.cfg.COMPUTER_MAX_MINUTES_PER_DAY * 60 - used < MIN_WAKE_SECONDS,
      working: this.state === "running" ? this.working() : [],
      message: this.message,
      session: end ? { endsInMs: Math.max(0, end.at - now), warning: this.warned || end.at - now <= this.wrapMs, wrapping: this.wrapping, reason: end.reason } : undefined,
      snapshotAt: this.snapshotAt,
      updatedAt: now,
    };
  }

  /** The screen saved when the computer last went to sleep, for the asleep preview. */
  async snapshot(): Promise<{ at: number; png: Uint8Array } | null> {
    return (await this.ctx.storage.get<{ at: number; png: Uint8Array }>("snapshot")) ?? null;
  }

  protected async publishStatus() {
    this.broadcast({ type: "status", status: await this.status() });
  }

  protected async setState(state: State, message?: string) {
    this.state = state;
    this.message = message;
    await this.persist();
    await this.publishStatus();
  }
}
