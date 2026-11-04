import { toast } from "sonner";
import type { WireEvent } from "@/features/chat/lib/stream";

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
}
