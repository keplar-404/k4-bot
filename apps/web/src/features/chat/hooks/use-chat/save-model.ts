import { saveBotModel } from "@/features/bots/api";
import type { ChatState } from "./types";

/** Saves the picked model for the bot after 500 ms of no change; `pendingSaveRef` lets a leaving page flush it. */
export function scheduleModelSave(
  state: ChatState,
  botId: string,
  id: string,
  effort: string | null,
) {
  if (state.saveTimerRef.current) clearTimeout(state.saveTimerRef.current);
  const save = () => {
    state.pendingSaveRef.current = null;
    saveBotModel(botId, id, effort).catch(() =>
      state.setError({
        kind: "server",
        message:
          "Couldn't save the model for this bot. It is used for now, but not kept.",
        retryable: false,
      }),
    );
  };
  state.pendingSaveRef.current = save;
  state.saveTimerRef.current = setTimeout(() => {
    state.saveTimerRef.current = null;
    save();
  }, 500);
}
