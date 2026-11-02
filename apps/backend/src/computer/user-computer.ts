import { DurableObject } from "cloudflare:workers";
import { CommandExitError, NotFoundError, Sandbox } from "@e2b/desktop";
import { parseEnv, type Env } from "../lib/env";
import {
  DENY_OUT,
  botHome,
  botUnixUser,
  checkKeys,
  checkTypedText,
  checkUrl,
  parseAllowedHosts,
  shellQuote,
} from "./guards";
import {
  SCREEN,
  computerActionSchema,
  type ActionResult,
  type ActivityEvent,
  type ComputerAction,
  type ComputerState,
  type ComputerStatus,
  type ExecResult,
  type Owner,
} from "./types";

/** E2B sandbox timeout. Extended while there is activity; on expiry E2B pauses (never kills) the computer. */
const SESSION_MS = 10 * 60_000;
const EXTEND_WHEN_BELOW_MS = 3 * 60_000;
/** A bot keeps the mouse and keyboard this long after its last action, so a crashed run cannot block others. */
const BOT_LEASE_MS = 45_000;
const USER_LEASE_MS = 5 * 60_000;
const TICK_MS = 30_000;
const ACTIONS_PER_MINUTE = 90;
const MAX_PARALLEL_EXEC = 4;
const MAX_OUTPUT_CHARS = 30_000;

/** Our own VNC servers. 5911/6091 is read-only (enforced by x11vnc itself), 5912/6092 is interactive. */
type Ports = { vnc: number; web: number };
const VIEW: Ports = { vnc: 5911, web: 6091 };
const CONTROL: Ports = { vnc: 5912, web: 6092 };

const SETTLE_MS: Record<ComputerAction["action"], number> = {
  screenshot: 0,
  mouse_move: 200,
  left_click: 700,
  right_click: 700,
  middle_click: 700,
  double_click: 700,
  left_click_drag: 700,
  type: 400,
  key: 600,
  scroll: 500,
  wait: 0,
  open_url: 2500,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const today = () => new Date().toISOString().slice(0, 10);
const cap = (s: string) => (s.length > MAX_OUTPUT_CHARS ? `${s.slice(0, MAX_OUTPUT_CHARS)}\n[output truncated]` : s);

/**
 * One E2B desktop per user, shared by all of that user's bots.
 *
 * Why a Durable Object: it is the single place that knows whether the
 * computer is awake, who holds the mouse, and how many minutes were used
 * today, and it serialises everything that must not interleave. State lives
 * in DO storage, so nothing here calls E2B just to answer a status question.
 *
 * How bots stay out of each other's way:
 *  - files/shell: each bot is its own Linux user with a private (700) home;
 *  - browser:    each bot gets its own Chrome profile and window class;
 *  - mouse/keys: one lease, held per bot while it works, and the user can take it.
 */
export class UserComputerDurableObject extends DurableObject<Env> {
  private sbx?: Sandbox;
  private starting?: Promise<Sandbox>;
  private gui: Promise<unknown> = Promise.resolve();
  private botUsers = new Set<string>();
  private vncFor?: string;
  private execInFlight = 0;
  private recentActions: number[] = [];
  private runActions = new Map<string, number>();
  private activity: ActivityEvent[] = [];
  private lastDriver?: string;

  private state: ComputerState = "off";
  private lease: { owner: Owner; until: number } | null = null;
  private lastActivity = 0;
  private lastTick = 0;
  private expiresAt = 0;
  private message?: string;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<{ state: ComputerState; expiresAt: number; lastActivity: number }>("core");
      if (saved) {
        // After eviction we have no sandbox object, but we know its id and that it was running: it stays
        // "running" so the alarm keeps metering and pausing it, and the next call reconnects to it.
        this.state = saved.state;
        this.expiresAt = saved.expiresAt;
        this.lastActivity = saved.lastActivity;
        this.lastTick = Date.now();
        if (saved.state === "running") void ctx.storage.getAlarm().then((at) => (at ? undefined : ctx.storage.setAlarm(Date.now() + TICK_MS)));
      }
    });
  }

  private get cfg() {
    return parseEnv(this.env);
  }

  // ---------------------------------------------------------------- status

  private async usedSeconds(): Promise<number> {
    const u = await this.ctx.storage.get<{ day: string; seconds: number }>("usage");
    return u?.day === today() ? u.seconds : 0;
  }

  async status(): Promise<ComputerStatus> {
    return {
      state: this.state,
      lease: this.lease && this.lease.until > Date.now() ? this.lease.owner : null,
      minutesUsedToday: Math.round((await this.usedSeconds()) / 60),
      minutesLimit: this.cfg.COMPUTER_MAX_MINUTES_PER_DAY,
      message: this.message,
      updatedAt: Date.now(),
    };
  }

  private async persist() {
    await this.ctx.storage.put("core", { state: this.state, expiresAt: this.expiresAt, lastActivity: this.lastActivity });
  }

  private async publishStatus() {
    this.broadcast({ type: "status", status: await this.status() });
  }

  private async setState(state: ComputerState, message?: string) {
    this.state = state;
    this.message = message;
    await this.persist();
    await this.publishStatus();
  }

  // ---------------------------------------------------------------- lifecycle

  private assertEnabled() {
    const cfg = this.cfg;
    if (!cfg.COMPUTER_ENABLED) throw new Error("The computer feature is turned off.");
    if (!cfg.E2B_API_KEY) throw new Error("The computer is not configured on this server.");
  }

  private async assertQuota() {
    const limit = this.cfg.COMPUTER_MAX_MINUTES_PER_DAY * 60;
    if ((await this.usedSeconds()) >= limit) {
      throw new Error(`Daily computer time limit reached (${this.cfg.COMPUTER_MAX_MINUTES_PER_DAY} min). It resets at 00:00 UTC.`);
    }
  }

  /** Wakes or creates the computer. Idempotent; concurrent callers share one start. */
  async ensure(): Promise<void> {
    await this.live();
  }

  private async live(): Promise<Sandbox> {
    this.assertEnabled();
    await this.assertQuota();
    if (this.sbx && this.state === "running") return this.sbx;
    this.starting ??= this.start().finally(() => {
      this.starting = undefined;
    });
    return this.starting;
  }

  private async start(): Promise<Sandbox> {
    const cfg = this.cfg;
    await this.setState("starting");
    try {
      const apiKey = cfg.E2B_API_KEY;
      const id = await this.ctx.storage.get<string>("sandboxId");
      let sbx: Sandbox | undefined;

      if (id) {
        try {
          // connect() resumes a paused sandbox with its memory (open windows, running apps) intact.
          sbx = await Sandbox.connect(id, { apiKey, timeoutMs: SESSION_MS });
        } catch (error) {
          if (!(error instanceof NotFoundError)) throw error;
        }
      }
      if (!sbx) {
        const allowed = parseAllowedHosts(cfg.COMPUTER_ALLOWED_HOSTS);
        const network = {
          // Private to everyone but this Durable Object: reached only through our authenticated proxy.
          allowPublicTraffic: false,
          ...(allowed.length > 0
            ? { allowOut: allowed.flatMap((h) => [h, `*.${h}`]), denyOut: ["0.0.0.0/0"] }
            : { denyOut: DENY_OUT }),
        };
        const options = {
          apiKey,
          resolution: [SCREEN.width, SCREEN.height] as [number, number],
          dpi: 96,
          timeoutMs: SESSION_MS,
          // On timeout E2B pauses (memory kept, billing stops) instead of destroying the work.
          lifecycle: { onTimeout: "pause" as const, autoResume: false },
          network,
          metadata: { app: "k4-bot" },
        };
        sbx = cfg.E2B_TEMPLATE === "desktop" ? await Sandbox.create(options) : await Sandbox.create(cfg.E2B_TEMPLATE, options);
        this.botUsers.clear();
        this.vncFor = undefined;
        await this.ctx.storage.put("sandboxId", sbx.sandboxId);
      }

      this.sbx = sbx;
      const now = Date.now();
      this.expiresAt = now + SESSION_MS;
      this.lastActivity = now;
      this.lastTick = now;
      await this.setState("running");
      await this.ctx.storage.setAlarm(now + TICK_MS);
      return sbx;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start the computer.";
      await this.setState("error", message);
      throw new Error(message);
    }
  }

  /** Pause keeps disk and memory and stops billing. Safe to call when already paused. */
  async pause(reason = "paused"): Promise<void> {
    const sbx = this.sbx;
    this.sbx = undefined;
    this.lease = null;
    this.vncFor = undefined;
    // After an eviction there is no sandbox object, but the id is enough to pause it.
    const id = sbx?.sandboxId ?? (await this.ctx.storage.get<string>("sandboxId"));
    if (id) await Sandbox.pause(id, { apiKey: this.cfg.E2B_API_KEY }).catch(() => undefined);
    if (this.state === "running" || this.state === "starting") await this.setState("paused", reason);
  }

  /** Destroys the computer and its disk. For abuse handling and account deletion. */
  async destroy(): Promise<void> {
    const id = await this.ctx.storage.get<string>("sandboxId");
    this.sbx = undefined;
    this.lease = null;
    if (id) await Sandbox.kill(id, { apiKey: this.cfg.E2B_API_KEY }).catch(() => undefined);
    await this.ctx.storage.delete("sandboxId");
    this.botUsers.clear();
    await this.setState("off");
  }

  /** Runs `fn` against the live sandbox; if E2B says it went away (paused/expired), wakes it and retries once. */
  private async withSandbox<T>(fn: (sbx: Sandbox) => Promise<T>): Promise<T> {
    try {
      return await fn(await this.live());
    } catch (error) {
      if (!(error instanceof NotFoundError) && !/not running|paused|not found|timed out|expired/i.test(String(error))) throw error;
      this.sbx = undefined;
      if (this.state === "running") this.state = "paused";
      return fn(await this.live());
    }
  }

  private async touch() {
    this.lastActivity = Date.now();
  }

  // ---------------------------------------------------------------- the lease

  private holder(): Owner | null {
    return this.lease && this.lease.until > Date.now() ? this.lease.owner : null;
  }

  private sameOwner(a: Owner | null, b: Owner) {
    return a !== null && a.kind === b.kind && (a.kind === "user" || (b.kind === "bot" && a.id === b.id));
  }

  /** Waits (up to `waitMs`) until `owner` may drive. Returns a reason string when it may not. */
  private async acquire(owner: Owner, waitMs = 20_000): Promise<string | null> {
    const deadline = Date.now() + waitMs;
    for (;;) {
      const held = this.holder();
      if (!held || this.sameOwner(held, owner)) {
        this.lease = { owner, until: Date.now() + (owner.kind === "user" ? USER_LEASE_MS : BOT_LEASE_MS) };
        await this.publishStatus();
        return null;
      }
      if (held.kind === "user") return "The user is controlling the computer right now. Wait with the wait action, then try again.";
      if (Date.now() >= deadline) return "Another bot is using the computer right now. Do other work or wait, then try again.";
      await sleep(500);
    }
  }

  async releaseBot(botId: string): Promise<void> {
    if (this.lease?.owner.kind === "bot" && this.lease.owner.id === botId) {
      this.lease = null;
      await this.publishStatus();
    }
  }

  /** The user takes the mouse and keyboard. The agent's GUI actions are refused until it is released. */
  async takeControl(): Promise<{ ok: boolean; message?: string }> {
    this.assertEnabled();
    if (this.state !== "running") return { ok: false, message: "The computer is asleep. Wake it first." };
    const held = this.holder();
    if (held?.kind === "bot") {
      // Let the bot finish the action in flight, then it is told the user is in control.
      this.lease = null;
    }
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

  // ---------------------------------------------------------------- bots

  private async botUser(sbx: Sandbox, botId: string): Promise<string> {
    const checked = botUnixUser(botId);
    if (!checked.ok) throw new Error(checked.reason);
    const user = checked.value;
    if (!this.botUsers.has(user)) {
      await sbx.commands.run(`id -u ${user} >/dev/null 2>&1 || (useradd -m -s /bin/bash ${user} && chmod 700 ${botHome(user)})`, {
        user: "root",
      });
      this.botUsers.add(user);
    }
    return user;
  }

  private async runAs(sbx: Sandbox, user: string, command: string, timeoutMs = 120_000, background = false) {
    const home = botHome(user);
    return sbx.commands.run(command, {
      user,
      cwd: home,
      envs: { HOME: home, DISPLAY: sbx.display, LANG: "C.UTF-8" },
      timeoutMs,
      ...(background ? { background: true as const } : {}),
    });
  }

  /** Shell for the file tools and the `execute` tool. Runs as the bot's own Linux user. */
  async exec(botId: string, command: string, timeoutMs?: number): Promise<ExecResult> {
    if (command.length > 20_000) return { output: "Command too long.", exitCode: 2, truncated: false };
    if (this.execInFlight >= MAX_PARALLEL_EXEC) {
      return { output: "Too many commands are running at once. Wait for one to finish and retry.", exitCode: 75, truncated: false };
    }
    this.execInFlight++;
    try {
      return await this.withSandbox(async (sbx) => {
        const user = await this.botUser(sbx, botId);
        await this.touch();
        try {
          const r = await this.runAs(sbx, user, command, Math.min(timeoutMs ?? 120_000, 600_000));
          const output = r.stdout + r.stderr;
          return { output: cap(output), exitCode: r.exitCode ?? 0, truncated: output.length > MAX_OUTPUT_CHARS };
        } catch (error) {
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

  private inHome(user: string, path: string) {
    return path.startsWith(`${botHome(user)}/`) && !path.split("/").includes("..");
  }

  async upload(botId: string, files: Array<[string, Uint8Array]>): Promise<Array<{ path: string; error: string | null }>> {
    return this.withSandbox(async (sbx) => {
      const user = await this.botUser(sbx, botId);
      const out: Array<{ path: string; error: string | null }> = [];
      for (const [path, data] of files) {
        if (!this.inHome(user, path)) {
          out.push({ path, error: "permission_denied" });
          continue;
        }
        try {
          await sbx.files.write(path, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, { user });
          out.push({ path, error: null });
        } catch {
          out.push({ path, error: "permission_denied" });
        }
      }
      return out;
    });
  }

  async download(botId: string, paths: string[]): Promise<Array<{ path: string; content: Uint8Array | null; error: string | null }>> {
    return this.withSandbox(async (sbx) => {
      const user = await this.botUser(sbx, botId);
      const out: Array<{ path: string; content: Uint8Array | null; error: string | null }> = [];
      for (const path of paths) {
        if (!this.inHome(user, path)) {
          out.push({ path, content: null, error: "permission_denied" });
          continue;
        }
        try {
          out.push({ path, content: await sbx.files.read(path, { format: "bytes", user }), error: null });
        } catch (error) {
          out.push({ path, content: null, error: error instanceof NotFoundError ? "file_not_found" : "permission_denied" });
        }
      }
      return out;
    });
  }

  // ---------------------------------------------------------------- the mouse and keyboard

  private note(botId: string, text: string) {
    const event: ActivityEvent = { botId, text, at: Date.now() };
    this.activity = [...this.activity.slice(-49), event];
    this.broadcast({ type: "activity", event });
  }

  private rateLimited(): boolean {
    const now = Date.now();
    this.recentActions = this.recentActions.filter((t) => now - t < 60_000);
    if (this.recentActions.length >= ACTIONS_PER_MINUTE) return true;
    this.recentActions.push(now);
    return false;
  }

  /**
   * One GUI action, followed by a screenshot. Everything is validated again here:
   * the tool already validated it, but this is the trust boundary, so it does not rely on the caller.
   */
  async act(botId: string, runId: string, input: unknown): Promise<ActionResult> {
    const parsed = computerActionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, text: `Invalid action: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}. Coordinates are whole PIXELS on the ${SCREEN.width}x${SCREEN.height} screenshot, not fractions.` };
    const action = parsed.data;

    const used = (this.runActions.get(runId) ?? 0) + 1;
    if (used > this.cfg.COMPUTER_MAX_ACTIONS_PER_RUN) {
      return { ok: false, text: "This task has used its computer action budget. Summarise what you did and stop, or ask the user to continue." };
    }
    if (this.rateLimited()) return { ok: false, text: "Too many actions this minute. Use the wait action, then continue." };
    this.runActions.set(runId, used);
    if (this.runActions.size > 200) this.runActions.delete(this.runActions.keys().next().value!);

    const owner: Owner = { kind: "bot", id: botId };
    const refused = await this.acquire(owner);
    if (refused) return { ok: false, text: refused };

    // Serialised: two bots' clicks and keystrokes must never interleave.
    const run = this.gui.then(() => this.perform(botId, action));
    this.gui = run.catch(() => undefined);
    return run;
  }

  private async perform(botId: string, action: ComputerAction): Promise<ActionResult> {
    try {
      return await this.withSandbox(async (sbx) => {
        await this.touch();
        const user = await this.botUser(sbx, botId);
        const q = (n: number) => String(Math.round(n));

        // Switching bots: bring that bot's windows to the front before it acts.
        if (this.lastDriver !== botId) {
          await sbx.commands
            .run(`xdotool search --onlyvisible --class ${shellQuote(`k4_${user}`)} | head -1 | xargs -r xdotool windowactivate`)
            .catch(() => undefined);
          this.lastDriver = botId;
        }
        if (this.lease?.owner.kind === "bot") this.lease.until = Date.now() + BOT_LEASE_MS;

        let text: string;
        switch (action.action) {
          case "screenshot":
            text = "Screenshot taken.";
            break;
          case "mouse_move":
            await sbx.commands.run(`xdotool mousemove ${q(action.x)} ${q(action.y)}`);
            text = `Moved the mouse to (${action.x}, ${action.y}).`;
            break;
          case "left_click":
          case "right_click":
          case "middle_click": {
            const button = { left_click: 1, right_click: 3, middle_click: 2 }[action.action];
            // No `--sync`: it waits ~15s when the pointer is already at the target.
            await sbx.commands.run(`xdotool mousemove ${q(action.x)} ${q(action.y)} click ${button}`);
            text = `${action.action.replace("_", " ")} at (${action.x}, ${action.y}).`;
            break;
          }
          case "double_click":
            await sbx.commands.run(`xdotool mousemove ${q(action.x)} ${q(action.y)} click --repeat 2 --delay 80 1`);
            text = `Double-clicked at (${action.x}, ${action.y}).`;
            break;
          case "left_click_drag":
            await sbx.commands.run(
              `xdotool mousemove ${q(action.x)} ${q(action.y)} mousedown 1 sleep 0.15 mousemove ${q(action.toX)} ${q(action.toY)} sleep 0.15 mouseup 1`,
            );
            text = `Dragged from (${action.x}, ${action.y}) to (${action.toX}, ${action.toY}).`;
            break;
          case "type": {
            const checked = checkTypedText(action.text);
            if (!checked.ok) return { ok: false, text: checked.reason };
            for (let i = 0; i < action.text.length; i += 500) {
              await sbx.commands.run(`xdotool type --delay 12 --clearmodifiers -- ${shellQuote(action.text.slice(i, i + 500))}`);
            }
            text = `Typed ${action.text.length} characters.`;
            break;
          }
          case "key": {
            const keys = checkKeys(action.keys);
            if (!keys.ok) return { ok: false, text: keys.reason };
            await sbx.commands.run(`xdotool key --clearmodifiers ${keys.value.map(shellQuote).join(" ")}`);
            text = `Pressed ${keys.value.join(" ")}.`;
            break;
          }
          case "scroll": {
            if (action.x !== undefined && action.y !== undefined) {
              await sbx.commands.run(`xdotool mousemove ${q(action.x)} ${q(action.y)}`);
            }
            const button = { up: 4, down: 5, left: 6, right: 7 }[action.direction];
            await sbx.commands.run(`xdotool click --repeat ${action.amount} --delay 40 ${button}`);
            text = `Scrolled ${action.direction} by ${action.amount}.`;
            break;
          }
          case "wait":
            await sleep(action.seconds * 1000);
            text = `Waited ${action.seconds}s.`;
            break;
          case "open_url": {
            const checked = checkUrl(action.url, parseAllowedHosts(this.cfg.COMPUTER_ALLOWED_HOSTS));
            if (!checked.ok) return { ok: false, text: checked.reason };
            // Own profile + own window class per bot: cookies and windows are never shared between bots.
            await this.runAs(
              sbx,
              user,
              `nohup google-chrome --class=${shellQuote(`k4_${user}`)} --user-data-dir=${shellQuote(`${botHome(user)}/.chrome`)} ` +
                `--no-first-run --no-default-browser-check --start-maximized --new-window ${shellQuote(checked.value)} >/dev/null 2>&1 &`,
              15_000,
              true,
            );
            // A cold Chrome start takes several seconds: wait for its window instead of returning a desktop screenshot.
            await this.runAs(
              sbx,
              user,
              `for i in $(seq 1 30); do xdotool search --onlyvisible --class ${shellQuote(`k4_${user}`)} >/dev/null 2>&1 && break; sleep 0.5; done`,
              20_000,
            );
            text = `Opened ${checked.value} in your browser window.`;
            break;
          }
        }

        await sleep(SETTLE_MS[action.action]);
        const screenshot = await sbx.screenshot();
        this.note(botId, text);
        return { ok: true, text, screenshot };
      });
    } catch (error) {
      return { ok: false, text: `Computer error: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  // ---------------------------------------------------------------- live view

  private async portsListening(sbx: Sandbox) {
    const r = await sbx.commands.run("ss -ltn | awk '{print $4}'");
    return { view: r.stdout.includes(`:${VIEW.web}`), control: r.stdout.includes(`:${CONTROL.web}`) };
  }

  /** Starts the two VNC servers (read-only and interactive) on first use. Idempotent. */
  private async ensureVnc(sbx: Sandbox) {
    if (this.vncFor === sbx.sandboxId) return;
    const up = await this.portsListening(sbx);
    const start = async (ports: Ports, viewOnly: boolean) => {
      await sbx.commands.run(
        `x11vnc -bg -display ${sbx.display} -forever -shared -nopw ${viewOnly ? "-viewonly " : ""}-rfbport ${ports.vnc} 2>/tmp/x11vnc-${ports.vnc}.log`,
      );
      await sbx.commands.run(
        `cd /opt/noVNC/utils && nohup ./novnc_proxy --vnc localhost:${ports.vnc} --listen ${ports.web} --web /opt/noVNC >/tmp/novnc-${ports.web}.log 2>&1 &`,
        { background: true, timeoutMs: 0 },
      );
    };
    if (!up.view) await start(VIEW, true);
    if (!up.control) await start(CONTROL, false);
    for (let i = 0; i < 20; i++) {
      const now = await this.portsListening(sbx);
      if (now.view && now.control) break;
      await sleep(300);
    }
    this.vncFor = sbx.sandboxId;
  }

  /** Where the Worker proxy should connect. Never wakes a sleeping computer (that costs money). */
  async viewerTarget(mode: "watch" | "control"): Promise<{ host: string; token: string } | { error: string }> {
    if (this.state !== "running") return { error: "asleep" };
    if (mode === "control" && this.holder()?.kind !== "user") return { error: "not_in_control" };
    try {
      // After a Durable Object eviction the VM is still running: reconnecting to it costs nothing.
      const sbx = this.sbx ?? (await this.live());
      await this.ensureVnc(sbx);
      return { host: sbx.getHost((mode === "watch" ? VIEW : CONTROL).web), token: sbx.trafficAccessToken ?? "" };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "unavailable" };
    }
  }

  // ---------------------------------------------------------------- panel websocket + meter

  override async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname !== "/ws" || request.headers.get("Upgrade") !== "websocket") {
      return new Response("Not found", { status: 404 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].send(JSON.stringify({ type: "status", status: await this.status() }));
    pair[1].send(JSON.stringify({ type: "activity-batch", events: this.activity.slice(-30) }));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override webSocketClose(ws: WebSocket, code: number, reason: string) {
    ws.close(code, reason);
  }

  private broadcast(message: unknown) {
    const frame = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(frame);
      } catch {
        // a closed socket is cleaned up by webSocketClose
      }
    }
  }

  /**
   * Runs every 30s while the computer is awake: counts the minutes used (the
   * budget guard), pauses it when idle, and keeps E2B's own timeout ahead of
   * real activity without calling E2B on every action.
   */
  override async alarm() {
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
      await this.pause("Daily computer time limit reached.");
    } else if (!userInControl && now - this.lastActivity > idleMs) {
      await this.pause("Paused after being idle.");
    } else {
      if (this.sbx && this.expiresAt - now < EXTEND_WHEN_BELOW_MS) {
        await this.sbx.setTimeout(SESSION_MS).catch(() => undefined);
        this.expiresAt = now + SESSION_MS;
      }
      await this.persist();
      await this.publishStatus();
      await this.ctx.storage.setAlarm(now + TICK_MS);
    }
  }
}
