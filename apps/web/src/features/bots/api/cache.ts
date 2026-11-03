import { api } from "@/lib/api-client";
import type { Bot, BotResult, BotsResult } from "./types";

/** Reads of the bot list and of one bot, each cached for TTL_MS so pages and the sidebar share one request. */
const TTL_MS = 30_000;

let cachedPromise: Promise<BotsResult> | null = null;
let cachedAt = 0;

const single = new Map<string, { at: number; promise: Promise<BotResult> }>();

export function invalidateBots() {
  cachedPromise = null;
  cachedAt = 0;
  single.clear();
}

export function fetchBot(id: string): Promise<BotResult> {
  const hit = single.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = (async (): Promise<BotResult> => {
    try {
      const res = await api.api.v1.bots[":id"].$get(
        { param: { id } },
        { init: { credentials: "include" } },
      );
      if (!res.ok) return { ok: false, status: res.status };
      const data = (await res.json()) as { bot: Bot };
      return { ok: true, bot: data.bot };
    } catch {
      return { ok: false, status: 0 };
    }
  })();
  single.set(id, { at: Date.now(), promise });
  return promise;
}

export function fetchBots(): Promise<BotsResult> {
  const now = Date.now();
  if (cachedPromise && now - cachedAt < TTL_MS) return cachedPromise;
  cachedAt = now;
  cachedPromise = (async (): Promise<BotsResult> => {
    try {
      const res = await api.api.v1.bots.$get(
        {},
        { init: { credentials: "include" } },
      );
      if (!res.ok) return { ok: false, status: res.status };
      const data = (await res.json()) as { bots: Bot[] };
      return { ok: true, bots: data.bots ?? [] };
    } catch {
      return { ok: false, status: 0 };
    }
  })();
  return cachedPromise;
}

/** Updates one bot in the cached list, so a re-read within the TTL sees the change without a refetch. */
export function patchCachedBot(id: string, fields: Partial<Bot>) {
  const one = single.get(id);
  if (one) {
    one.promise = one.promise.then((result) =>
      result.ok ? { ok: true, bot: { ...result.bot, ...fields } } : result,
    );
  }
  if (!cachedPromise) return;
  cachedPromise = cachedPromise.then((result) =>
    result.ok
      ? {
          ok: true,
          bots: result.bots.map((b) => (b.id === id ? { ...b, ...fields } : b)),
        }
      : result,
  );
}
