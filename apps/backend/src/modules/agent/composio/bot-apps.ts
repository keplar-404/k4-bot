import { eq } from "drizzle-orm";
import type { Db } from "../../../db";
import { botComposioApp } from "../../../db/schema";

export type BotComposioApp = { toolkit: string; connectedAccountId?: string; allowWrites: boolean };

/** The apps a bot may use. Each run re-checks the account at execution time (composio/execute.ts), so a stale row is harmless. */
export async function loadBotComposioApps(db: Db, botId: string): Promise<BotComposioApp[]> {
  const rows = await db.select().from(botComposioApp).where(eq(botComposioApp.botId, botId));
  return rows.map((r) => ({
    toolkit: r.toolkit,
    connectedAccountId: r.connectedAccountId ?? undefined,
    allowWrites: r.allowWrites,
  }));
}
