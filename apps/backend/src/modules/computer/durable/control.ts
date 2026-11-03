import type { Owner } from "../types";
import { BOT_LEASE_MS, type Closed, sleep, USER_LEASE_MS } from "./constants";
import { ComputerMeter } from "./meter";

const sameOwner = (a: Owner | null, b: Owner) => a !== null && a.kind === b.kind && (a.kind === "user" || (b.kind === "bot" && a.id === b.id));

/** The one mouse and keyboard: a lease a bot holds while it works, and that the user can take. */
export class ComputerControl extends ComputerMeter {
  /** Waits (up to `waitMs`) until `owner` may drive. Returns a reason string when it may not. */
  protected async acquire(owner: Owner, waitMs = 20_000): Promise<string | null> {
    const deadline = Date.now() + waitMs;
    for (;;) {
      const held = this.holder();
      if (!held || sameOwner(held, owner)) {
        this.lease = { owner, until: Date.now() + (owner.kind === "user" ? USER_LEASE_MS : BOT_LEASE_MS) };
        await this.publishStatus();
        return null;
      }
      if (held.kind === "user") return "The user is controlling the computer right now. Wait with the wait action, then try again.";
      if (Date.now() >= deadline) return "Another bot is using the computer right now. Do other work or wait, then try again.";
      await sleep(500);
    }
  }

  /** The bot's run (slice) ended: it lets go of the mouse and is no longer "using" the computer. */
  async releaseBot(botId: string): Promise<void> {
    this.marked.delete(botId);
    this.tables.removeWorker(botId);
    const closed = await this.ctx.storage.get<Closed>("closed");
    if (closed?.bots[botId]?.told) {
      delete closed.bots[botId];
      await this.ctx.storage.put("closed", closed);
    }
    if (this.lease?.owner.kind === "bot" && this.lease.owner.id === botId) {
      this.lease = null;
    }
    await this.publishStatus();
    await this.sleepIfWrapped();
  }

  /** The user takes the mouse and keyboard. The agent's GUI actions are refused until it is released. */
  async takeControl(): Promise<{ ok: boolean; message?: string }> {
    this.assertEnabled();
    if (this.state !== "running") return { ok: false, message: "The computer is asleep. Wake it first." };
    // A bot holding it lets go: it finishes the action in flight, then it is told the user is in control.
    this.lease = { owner: { kind: "user" }, until: Date.now() + USER_LEASE_MS };
    this.touch();
    // Start the interactive VNC server now, so the first connect after "Take control" is quick.
    if (this.sbx) await this.ensureVnc(this.sbx).catch(() => undefined);
    await this.publishStatus();
    return { ok: true };
  }

  /** The panel pings this while the user is in control, so a closed tab hands control back by itself. */
  async keepControl(): Promise<boolean> {
    if (this.lease?.owner.kind !== "user") return false;
    this.lease.until = Date.now() + USER_LEASE_MS;
    this.touch();
    return true;
  }

  async releaseControl(): Promise<void> {
    if (this.lease?.owner.kind === "user") {
      this.lease = null;
      this.touch();
      await this.publishStatus();
    }
  }
}
