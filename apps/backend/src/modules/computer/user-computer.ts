import { parseAllowedHosts } from "./guards";
import { type ActionResult, type ComputerAction, computerActionSchema, type Owner, SCREEN } from "./types";
import { ComputerPanel } from "./durable/panel";
import { ACTIONS_PER_MINUTE, BOT_LEASE_MS, SETTLE_MS, sleep } from "./durable/constants";
import { doAction, focusBotWindows } from "./durable/gui";

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
 *
 * Built in layers (durable/): state → status → sleep → machine → lifecycle → power → session → meter → control
 * → bots → panel. This last one adds the screen: one GUI action at a time, each followed by a screenshot.
 */
export class UserComputerDurableObject extends ComputerPanel {
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
    if (this.state !== "running") return { ok: false, text: await this.offMessage(botId) };
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
      return await this.withSandbox(botId, async (sbx) => {
        this.touch();
        const user = await this.botUser(sbx, botId);
        if (this.lastDriver !== botId) {
          await focusBotWindows(sbx, user);
          this.lastDriver = botId;
        }
        if (this.lease?.owner.kind === "bot") this.lease.until = Date.now() + BOT_LEASE_MS;
        const done = await doAction(sbx, user, action, parseAllowedHosts(this.cfg.COMPUTER_ALLOWED_HOSTS));
        if (!done.ok) return done;
        await sleep(SETTLE_MS[action.action]);
        const screenshot = await sbx.screenshot();
        this.note(botId, done.text);
        return { ok: true, text: done.text, screenshot };
      });
    } catch (error) {
      return { ok: false, text: `Computer error: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}
