import { api } from "@/lib/api-client";
import { invalidateBots, patchCachedBot } from "./cache";
import { type Bot, BotApiError, type CreateBotInput } from "./types";

/** A failed response as a BotApiError with the server's message, or `fallback`. */
async function throwIfFailed(
  res: { ok: boolean; status: number; json(): Promise<unknown> },
  fallback: string,
) {
  if (res.ok) return;
  const body = (await res.json().catch(() => null)) as {
    error?: string;
    message?: string;
  } | null;
  throw new BotApiError(body?.message ?? body?.error ?? fallback, res.status);
}

export async function createBot(input: CreateBotInput): Promise<Bot> {
  const res = await api.api.v1.bots.$post(
    { json: input },
    { init: { credentials: "include" } },
  );
  await throwIfFailed(res, "Failed to create bot");
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
  await throwIfFailed(res, "Failed to update bot");
  const data = (await res.json()) as { bot: Bot };
  invalidateBots();
  return data.bot;
}

/** What happened to the bot's Linux account on the computer (checked on the VM when it is awake). */
export type ComputerCleanup = "removed" | "pending" | "failed";

export async function deleteBot(id: string): Promise<ComputerCleanup> {
  const res = await api.api.v1.bots[":id"].$delete(
    { param: { id } },
    { init: { credentials: "include" } },
  );
  await throwIfFailed(res, "Failed to delete bot");
  invalidateBots();
  const body = (await res.json().catch(() => null)) as {
    computer?: ComputerCleanup;
  } | null;
  return body?.computer ?? "pending";
}

/** Saves the model (and reasoning level) picked for a bot, so it is still selected after a refresh. */
export async function saveBotModel(
  id: string,
  modelId: string,
  reasoningEffort: string | null,
): Promise<void> {
  const res = await api.api.v1.bots[":id"].model.$put(
    { param: { id }, json: { modelId, reasoningEffort } },
    { init: { credentials: "include" } },
  );
  await throwIfFailed(res, "Failed to save the model");
  patchCachedBot(id, { modelId, reasoningEffort });
}

/** The user's admin bot (manages their other bots and groups). The server keeps one per user. */
export async function createAdminBot(): Promise<Bot> {
  const res = await api.api.v1.bots.admin.$post(
    {},
    { init: { credentials: "include" } },
  );
  await throwIfFailed(res, "Failed to add the admin bot");
  const data = (await res.json()) as { bot: Bot };
  invalidateBots();
  return data.bot;
}
