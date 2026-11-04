import { DurableObject } from "cloudflare:workers";
import type { Sandbox } from "e2b";
import { parseEnv, type Env } from "../../config/env";
import { createDb } from "../../db";
import { BUSY_MS, type Core, type SandboxState, TICK_MS } from "./constants";

/**
 * First layer of a bot's code sandbox (one Durable Object per bot, named by bot id): what it remembers. The persisted
 * part (`Core`) survives evictions; the E2B handle is reconnected on demand.
 */
export class SandboxStateDO extends DurableObject<Env> {
  protected sbx?: Sandbox;
  protected sbxId?: string;
  protected state: SandboxState = "none";
  protected userId?: string;
  protected lastActivity = 0;
  protected workingUntil = 0;
  protected lastTick = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<Core>("core");
      if (!saved) return;
      this.state = saved.state;
      this.sbxId = saved.sandboxId;
      this.userId = saved.userId;
      this.lastActivity = saved.lastActivity;
      this.workingUntil = saved.workingUntil;
      this.lastTick = saved.lastTick;
    });
  }

  protected get cfg() {
    return parseEnv(this.env);
  }

  protected get db() {
    return createDb(this.cfg.DATABASE_URL);
  }

  protected get botId() {
    return this.ctx.id.name ?? "";
  }

  protected persist() {
    const core: Core = { state: this.state, sandboxId: this.sbxId, userId: this.userId, lastActivity: this.lastActivity, workingUntil: this.workingUntil, lastTick: this.lastTick };
    return this.ctx.storage.put("core", core);
  }

  /** A bot used the sandbox: it counts as working for BUSY_MS, and the idle clock restarts. */
  protected markWorking() {
    const now = Date.now();
    this.lastActivity = now;
    this.workingUntil = now + BUSY_MS;
  }

  protected get working() {
    return Date.now() < this.workingUntil;
  }

  /** The alarm runs while the sandbox runs (metering and idle pause). */
  protected async scheduleAlarm() {
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
  }

  /** Sends an event to every open code editor of this sandbox (file changes, command output). */
  protected broadcast(event: object) {
    const frame = JSON.stringify(event);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(frame);
      } catch {
        // a closed socket is cleaned up by webSocketClose
      }
    }
  }

  /** An open code editor keeps the sandbox awake (the user may be about to save). */
  protected get editorOpen() {
    return this.ctx.getWebSockets().length > 0;
  }

  /** Every call names its user; a sandbox answers only its owner. */
  protected owns(userId: string) {
    return !this.userId || this.userId === userId;
  }
}
