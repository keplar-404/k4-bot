"use client";

import { useCallback } from "react";
import { saveBotModel } from "@/features/bots/api";
import { toInfo } from "./helpers";
import { answerImpl, decideImpl, stopImpl } from "./resume";
import { scheduleModelSave } from "./save-model";

import type { ChatCtx, ChatState } from "./types";
export function useChatActionsMeta(
  state: ChatState,
  botId: string,
  ctxRef: React.MutableRefObject<ChatCtx | null>,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs and setters are stable; deps preserved from original
  const decide = useCallback(
    (type: "approve" | "reject") => decideImpl(ctxRef.current!, type),
    [],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs and setters are stable; deps preserved from original
  const answer = useCallback(
    (text: string) => answerImpl(ctxRef.current!, text),
    [],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs and setters are stable; deps preserved from original
  const stop = useCallback(() => stopImpl(ctxRef.current!), []);
  const dismissError = useCallback(
    () => state.setError(null),
    [state.setError],
  );
  const approve = useCallback(() => void decide("approve"), [decide]);
  const reject = useCallback(() => void decide("reject"), [decide]);
  const select = useCallback(
    (id: string, effort: string | null) => {
      state.modelIdRef.current = id;
      state.reasoningEffortRef.current = effort ?? undefined;
      state.setModelId(id);
      state.setReasoningEffort(effort);
    },
    [state],
  );
  const chooseModel = useCallback(
    (id: string, effort: string | null) => {
      select(id, effort);
      scheduleModelSave(state, botId, id, effort);
    },
    [botId, select, state],
  );
  return {
    decide,
    answer,
    stop,
    dismissError,
    approve,
    reject,
    select,
    chooseModel,
  };
}
