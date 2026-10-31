import type { ExpressionId } from "@/lib/bloub/bot/expressions";
import type { ColorId, ShapeId } from "@/lib/bloub/bot/skins";
import { api } from "./api-client";

export type Bot = {
  id: string;
  name: string;
  description: string | null;
  shape: string;
  color: string;
  expression: string;
};

export type BotsResult =
  | { ok: true; bots: Bot[] }
  | { ok: false; status: number };

const TTL_MS = 30_000;

let cachedPromise: Promise<BotsResult> | null = null;
let cachedAt = 0;

export function invalidateBots() {
  cachedPromise = null;
  cachedAt = 0;
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

export type CreateBotInput = {
  name: string;
  description?: string;
  shape: ShapeId;
  color: ColorId;
  expression: ExpressionId;
};

export class BotApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "BotApiError";
    this.status = status;
  }
}

function parseErrorBody(
  body: { error?: string; message?: string } | null,
  fallback: string,
): string {
  return body?.message ?? body?.error ?? fallback;
}

export async function createBot(input: CreateBotInput): Promise<Bot> {
  const res = await api.api.v1.bots.$post(
    { json: input },
    { init: { credentials: "include" } },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    throw new BotApiError(
      parseErrorBody(body, "Failed to create bot"),
      res.status,
    );
  }
  const data = (await res.json()) as { bot: Bot };
  invalidateBots();
  return data.bot;
}

export async function updateBot(
  id: string,
  input: CreateBotInput,
): Promise<Bot> {
  const res = await api.api.v1.bots[":id"].$patch(
    { param: { id }, json: input },
    { init: { credentials: "include" } },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    throw new BotApiError(
      parseErrorBody(body, "Failed to update bot"),
      res.status,
    );
  }
  const data = (await res.json()) as { bot: Bot };
  invalidateBots();
  return data.bot;
}

export async function deleteBot(id: string): Promise<void> {
  const res = await api.api.v1.bots[":id"].$delete(
    { param: { id } },
    { init: { credentials: "include" } },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new BotApiError(
      parseErrorBody(body, "Failed to delete bot"),
      res.status,
    );
  }
  invalidateBots();
}
