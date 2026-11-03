import { NotFoundError, type Sandbox } from "@e2b/desktop";
import { ComputerOffError } from "./constants";
import { ComputerLifecycle } from "./lifecycle";

/** Who may turn the computer on: the user (wake), sign-up provisioning, and bots' work only while it is running. */
export class ComputerPower extends ComputerLifecycle {
  /** Wakes or creates the computer. Idempotent; concurrent callers share one start. */
  async ensure(): Promise<void> {
    this.provisionOnly = false;
    await this.live();
  }

  /**
   * A new (verified) user gets their own fresh computer: created now, then put to sleep at once, so it
   * exists and their first wake-up is a quick resume. Runs in an alarm (retried by the platform if it
   * fails) so the sign-up request never waits on E2B. Never called for unverified sign-ups.
   */
  async provision(): Promise<void> {
    const cfg = this.cfg;
    if (!cfg.COMPUTER_ENABLED || !cfg.E2B_API_KEY) return;
    if (await this.ctx.storage.get<string>("sandboxId")) return;
    await this.ctx.storage.put("provision", true);
    await this.ctx.storage.setAlarm(Date.now());
  }

  /** If it throws, the flag stays and the platform retries the alarm (with backoff). */
  protected async runProvisioning() {
    const needed = (this.state === "off" || this.state === "error") && !(await this.ctx.storage.get<string>("sandboxId"));
    if (needed) {
      this.provisionOnly = true;
      try {
        await this.live();
        if (this.provisionOnly) await this.pause("Your computer is ready. Wake it, or a bot asks you to when it needs it.");
      } finally {
        this.provisionOnly = false;
      }
    }
    await this.ctx.storage.delete("provision");
  }

  /**
   * Runs an agent's work against the running computer. Agents never wake it: when it is off they are told
   * to ask (turn_on_computer, which needs the user's approval). If E2B says it went to sleep on its own,
   * it is marked asleep instead of being woken behind the user's back.
   */
  protected async withSandbox<T>(botId: string, fn: (sbx: Sandbox) => Promise<T>): Promise<T> {
    if (this.state !== "running") throw new ComputerOffError(await this.offMessage(botId));
    try {
      return await fn(await this.live());
    } catch (error) {
      // The computer went to sleep (or was shut down) while this call was in flight: say so, not E2B's raw error.
      if (this.state !== "running" || this.pausing) throw new ComputerOffError(await this.offMessage(botId));
      if (!(error instanceof NotFoundError) && !/not running|paused|not found|expired/i.test(String(error))) throw error;
      this.sbx = undefined;
      await this.setState("paused", "Went to sleep.");
      throw new ComputerOffError(await this.offMessage(botId));
    }
  }
}
