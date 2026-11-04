import type { Env } from "../../../../config/env";
import type { BudgetStore } from "./budget";
import { WebGuard } from "./guard";

export type WebAccess = { apiKey: string; guard: WebGuard };

type LimitEnv = Pick<Env, "TAVILY_API_KEY" | "TAVILY_CREDITS_PER_DAY" | "TAVILY_CREDITS_PER_USER_PER_DAY" | "TAVILY_CREDITS_PER_RUN" | "TAVILY_RESEARCH_PER_USER_PER_DAY">;

/**
 * The web tools' key and guard for one run (a chat run, a background task), or undefined when Tavily is not
 * configured. `runId` scopes the per-run cap: sub-agents get their lead's access, so a group shares one budget.
 */
export function webAccess(env: LimitEnv, store: BudgetStore, ids: { userId: string; runId: string }): WebAccess | undefined {
  if (!env.TAVILY_API_KEY) return undefined;
  return {
    apiKey: env.TAVILY_API_KEY,
    guard: new WebGuard(store, ids, {
      perDay: env.TAVILY_CREDITS_PER_DAY,
      perUserPerDay: env.TAVILY_CREDITS_PER_USER_PER_DAY,
      perRun: env.TAVILY_CREDITS_PER_RUN,
      researchPerUserPerDay: env.TAVILY_RESEARCH_PER_USER_PER_DAY,
    }),
  };
}
