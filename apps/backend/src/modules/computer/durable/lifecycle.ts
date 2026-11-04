import type { Sandbox } from "@e2b/desktop";
import { MIN_WAKE_SECONDS, SESSION_MS } from "./constants";
import { ComputerMachine } from "./machine";
import { connectSandbox, createSandbox, findOwnSandbox, HARDEN } from "./sandbox";

/** Waking the computer: reconnect, adopt or create the sandbox, harden it, start the screen and a new session. */
export class ComputerLifecycle extends ComputerMachine {
  /** A running computer may use its last second; waking it needs a minute left (MIN_WAKE_SECONDS). */
  private async assertQuota() {
    const left = this.cfg.COMPUTER_MAX_MINUTES_PER_DAY * 60 - (await this.usedSeconds());
    if (left <= 0 || (this.state !== "running" && left < MIN_WAKE_SECONDS)) {
      throw new Error(`Daily computer time limit reached (${this.cfg.COMPUTER_MAX_MINUTES_PER_DAY} min). It resets at 00:00 UTC.`);
    }
  }

  /** The running sandbox; starts it when needed. Concurrent callers share one start. */
  protected async live(): Promise<Sandbox> {
    this.assertEnabled();
    await this.assertQuota();
    if (this.sbx && this.state === "running") return this.sbx;
    this.starting ??= this.start().finally(() => {
      this.starting = undefined;
    });
    return this.starting;
  }

  private async start(): Promise<Sandbox> {
    // After an eviction the computer is still running and we only lost the sandbox object:
    // reconnecting is free and must not restart the session clock.
    const reconnecting = this.state === "running";
    const startedAt = Date.now();
    if (!reconnecting) await this.setState("starting", "Waking your computer…");
    try {
      const id = await this.ctx.storage.get<string>("sandboxId");
      const sbx = await this.openSandbox(id, reconnecting);
      this.sbx = sbx;
      if (this.hardenedFor !== sbx.sandboxId) {
        await sbx.commands.run(HARDEN, { user: "root" }).catch((e) => console.error("[computer] harden", e));
        this.hardenedFor = sbx.sandboxId;
      }
      // Bots deleted while the computer slept: remove their accounts and files before anyone can use it.
      await this.purgeRemovedBots(sbx).catch((e) => console.error("[computer] purge", e));
      if (!reconnecting) await this.beginSession(sbx, id === sbx.sandboxId, startedAt);
      return sbx;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start the computer.";
      await this.setState("error", message);
      throw new Error(message);
    }
  }

  /**
   * The saved sandbox, or (one computer per user) the user's own one found by its metadata if this object lost track
   * of it (it crashed between creating it and saving its id), or else a new one.
   */
  private async openSandbox(id: string | undefined, reconnecting: boolean): Promise<Sandbox> {
    const apiKey = this.cfg.E2B_API_KEY;
    const known = id ? await connectSandbox(id, apiKey) : undefined;
    if (known) return known;
    let sbx = await findOwnSandbox(apiKey, this.ctx.id.name);
    if (!sbx) {
      if (!reconnecting) await this.setState("starting", "Setting up a new computer…");
      sbx = await createSandbox(this.cfg, this.ctx.id.name);
      this.tables.markPurged();
    }
    this.botUsers.clear();
    this.vncFor = undefined;
    this.directoryDirty = true;
    await this.ctx.storage.put("sandboxId", sbx.sandboxId);
    return sbx;
  }

  private async beginSession(sbx: Sandbox, resumed: boolean, startedAt: number) {
    const booted = Date.now();
    // Start the screen servers now, so the live preview connects the moment the computer is "running".
    await this.setState("starting", "Starting the screen…");
    await this.ensureVnc(sbx).catch((e) => console.error("[computer] vnc", e));
    const now = Date.now();
    console.log(`[computer] ${resumed ? "resumed" : "created"} in ${booted - startedAt}ms, screen ready in ${now - booted}ms`);
    this.expiresAt = now + SESSION_MS;
    this.lastActivity = now;
    this.lastTick = now;
    this.sessionEndsAt = now + (await this.limits()).sessionMinutes * 60_000;
    this.warned = false;
    this.wrapping = false;
    this.tables.clearWorkers();
    this.marked.clear();
    await this.ctx.storage.delete("closed");
    await this.setState("running");
    await this.scheduleAlarm();
  }
}
