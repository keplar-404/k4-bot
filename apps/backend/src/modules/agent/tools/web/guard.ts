import type { BudgetStore, Cap } from "./budget";

export interface WebLimits {
  perDay: number;
  perUserPerDay: number;
  perRun: number;
  researchPerUserPerDay: number;
}

/** What a Tavily call returns to the guard: text for the model, and the credits it really cost when Tavily said. */
export type Billed = { text: string; credits?: number };

type Scope = { key: string; cap: Cap; refused: string };

/**
 * Stops the bots from spending the app's Tavily money: every call reserves its worst-case cost against the whole
 * app's day, the user's day and the run (research: the user's daily research count instead of the run) before it
 * is sent, and is settled to the real cost after. Identical calls within one run segment are answered from memory.
 * Fails closed: if the budget cannot be checked, the call is not made.
 */
export class WebGuard {
  private readonly cache = new Map<string, Promise<string>>();

  constructor(
    private readonly store: BudgetStore,
    private readonly ids: { userId: string; runId: string },
    private readonly limits: WebLimits,
  ) {}

  private scopes(research: boolean): Scope[] {
    const { userId, runId } = this.ids;
    const l = this.limits;
    return [
      { key: "all", cap: { credits: l.perDay }, refused: "The app's web budget for today is used up (it resets at 00:00 UTC). Tell the user web tools are paused until then, and answer from what you already have." },
      { key: `user:${userId}`, cap: { credits: l.perUserPerDay }, refused: `The user's daily web budget (${l.perUserPerDay} credits) is used up; it resets at 00:00 UTC. Answer from the sources you already have and say so.` },
      research
        ? { key: `research:${userId}`, cap: { calls: l.researchPerUserPerDay }, refused: `The user has used today's ${l.researchPerUserPerDay} deep research runs; they reset at 00:00 UTC. Tell the user.` }
        : { key: `run:${runId}`, cap: { credits: l.perRun }, refused: `This task has used its web budget (${l.perRun} credits). Stop calling web tools: answer with the sources you have, and say the user can ask you to continue in a new message.` },
    ];
  }

  /** Runs `call` within the budgets. Returns its text, or a "NOT DONE" line the model can act on. Tool errors are rethrown (after a refund). */
  async run(endpoint: string, args: unknown, maxCredits: number, call: () => Promise<Billed>, research = false): Promise<string> {
    const key = `${endpoint}:${JSON.stringify(args)}`;
    const cached = this.cache.get(key);
    if (cached) return `${await cached}\n\n(Same call as earlier in this task: answered from memory, at no cost. Change the query or parameters to get new results.)`;

    const scopes = this.scopes(research);
    const held: Scope[] = [];
    try {
      for (const s of scopes) {
        if (!(await this.store.reserve(s.key, maxCredits, s.cap))) {
          await this.release(held, maxCredits);
          return `NOT DONE: ${s.refused}`;
        }
        held.push(s);
      }
    } catch (error) {
      await this.release(held, maxCredits).catch(() => undefined);
      console.error("[web-guard] budget check failed", error);
      return "NOT DONE: the web budget could not be checked just now, so the call was not made. Try once more in a moment, or answer without it.";
    }

    const pending = call().then(async (result) => {
      // Tavily reports what the call cost; without it the full reservation stands (never undercount).
      const delta = (result.credits ?? maxCredits) - maxCredits;
      await Promise.all(held.map((s) => this.store.adjust(s.key, delta))).catch((e) => console.error("[web-guard] settle failed", e));
      return result.text;
    });
    this.cache.set(key, pending);
    try {
      return await pending;
    } catch (error) {
      this.cache.delete(key);
      // Tavily does not charge failed requests: hand the whole reservation back.
      await this.release(held, maxCredits).catch(() => undefined);
      throw error;
    }
  }

  private release(held: Scope[], credits: number) {
    return Promise.all(held.map((s) => this.store.adjust(s.key, -credits, -1)));
  }
}
