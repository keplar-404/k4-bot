import { sql } from "drizzle-orm";
import type { Db } from "../../../../db";

/** A cap on one scope's day: credits and/or calls. Omitted means unlimited. */
export type Cap = { credits?: number; calls?: number };

/**
 * Where web spend is counted. `reserve` must be atomic: it adds the credits and one call only if the scope stays
 * within its cap, so parallel sub-agents can never overspend between a check and a write.
 */
export interface BudgetStore {
  reserve(scope: string, credits: number, cap: Cap): Promise<boolean>;
  /** Corrects a reservation once the real cost is known (`delta` < 0 refunds; `calls` -1 undoes the call). */
  adjust(scope: string, delta: number, calls?: number): Promise<void>;
  /** Credits and calls used today, for messages to the model. */
  used(scope: string): Promise<{ credits: number; calls: number }>;
}

const MAX = 2_147_483_647;
export const today = () => new Date().toISOString().slice(0, 10);

/** Postgres store: one row per scope and UTC day (db/schema/web.ts). Each method is a single statement. */
export function pgBudgetStore(db: Db): BudgetStore {
  return {
    async reserve(scope, credits, cap) {
      const maxCredits = cap.credits ?? MAX;
      const maxCalls = cap.calls ?? MAX;
      // INSERT…SELECT…WHERE covers a first call over the cap; ON CONFLICT…WHERE covers the rest. No row back = refused.
      const result = await db.execute(sql`
        INSERT INTO web_usage (scope, day, credits, calls)
        SELECT ${scope}, ${today()}, ${credits}, 1 WHERE ${credits} <= ${maxCredits} AND 1 <= ${maxCalls}
        ON CONFLICT (scope, day) DO UPDATE
          SET credits = web_usage.credits + EXCLUDED.credits, calls = web_usage.calls + 1, updated_at = now()
          WHERE web_usage.credits + EXCLUDED.credits <= ${maxCredits} AND web_usage.calls + 1 <= ${maxCalls}
        RETURNING credits`);
      return result.rows.length > 0;
    },
    async adjust(scope, delta, calls = 0) {
      if (delta === 0 && calls === 0) return;
      await db.execute(sql`
        UPDATE web_usage SET credits = GREATEST(0, credits + ${delta}), calls = GREATEST(0, calls + ${calls}), updated_at = now()
        WHERE scope = ${scope} AND day = ${today()}`);
    },
    async used(scope) {
      const result = await db.execute(sql`SELECT credits, calls FROM web_usage WHERE scope = ${scope} AND day = ${today()}`);
      const row = result.rows[0] as { credits?: number; calls?: number } | undefined;
      return { credits: Number(row?.credits ?? 0), calls: Number(row?.calls ?? 0) };
    },
  };
}

/** In-memory store with the same rules: for the CLI and the checks (one process, so no races to guard against). */
export function memoryBudgetStore(): BudgetStore {
  const rows = new Map<string, { credits: number; calls: number }>();
  const get = (scope: string) => rows.get(`${scope}|${today()}`) ?? { credits: 0, calls: 0 };
  const set = (scope: string, row: { credits: number; calls: number }) => rows.set(`${scope}|${today()}`, row);
  return {
    async reserve(scope, credits, cap) {
      const row = get(scope);
      if (row.credits + credits > (cap.credits ?? MAX) || row.calls + 1 > (cap.calls ?? MAX)) return false;
      set(scope, { credits: row.credits + credits, calls: row.calls + 1 });
      return true;
    },
    async adjust(scope, delta, calls = 0) {
      const row = get(scope);
      set(scope, { credits: Math.max(0, row.credits + delta), calls: Math.max(0, row.calls + calls) });
    },
    async used(scope) {
      return get(scope);
    },
  };
}
