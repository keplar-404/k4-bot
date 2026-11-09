import { toast } from "sonner";
import { request } from "@/features/chat/lib/client/http";
import type { WireEvent } from "@/features/chat/lib/stream";

/** Undo of an automatic memory update; the server refuses it if the memory changed since. */
const undoMemory = (eventId: string) =>
  request(`/api/v1/memory/events/${eventId}/undo`, { method: "POST" }).then(
    () => toast.success("Memory change undone."),
    (e: Error) => toast.error(e.message),
  );

/** Toasts for chat events that are news on their own, beside what the transcript shows. */
export function notifyFor(event: WireEvent) {
  const p = (event.payload ?? {}) as Record<string, unknown>;
  if (event.type === "run.retrying") {
    // One toast, replaced by each attempt: the model failed and the run tries again on its own.
    toast.info(
      `The model stopped responding. Retrying (${p.attempt ?? 1}/${p.maxAttempts ?? 10})…`,
      {
        id: "model-retry",
        description: `Trying again in ${Math.round(Number(p.inMs ?? 0) / 1000)}s. Your work so far is kept.`,
      },
    );
  }
  if (event.type === "async.task") {
    // A background task (start_background_task) ended; the bot hears about it before its next step.
    const ok = p.status === "success";
    const title = `Background task "${String(p.agent ?? "task")}" ${ok ? "finished" : p.status === "cancelled" ? "was cancelled" : "failed"}`;
    (ok ? toast.success : toast.info)(title, {
      description: ok
        ? "Ask the bot for its result, or it will tell you on its next reply."
        : undefined,
    });
  }
  if (event.type === "group.notice" && typeof p.text === "string") {
    toast.info(p.text, { id: "group-notice" });
  }
  if (event.type === "memory.updated" && typeof p.eventId === "string") {
    // The bot learned something lasting from this turn and saved it on its own: say so, and let the user take it back.
    const eventId = p.eventId;
    toast.success(
      p.scope === "preferences"
        ? "Your preferences were updated"
        : p.scope === "group"
          ? "The group notes were updated"
          : "The bot updated its memory",
      {
        id: `memory-${eventId}`,
        description:
          "From what you said in this chat. See it in the bot's Memory.",
        action: { label: "Undo", onClick: () => void undoMemory(eventId) },
        duration: 10_000,
      },
    );
  }
}
