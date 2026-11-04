import { clip, type Part, type PartsUsage, takeFileMarkers, type ToolPart } from "../parts";
import type { RunSink, RunStream, PendingInterrupt } from "./types";

export type { PendingInterrupt, RunSink, RunStream } from "./types";

/**
 * Consumes the stream, calling `sink` live and filling `acc` (so the caller
 * keeps the partial parts even if the run later throws, e.g. GraphRecursionError
 * when a slice reaches its step limit). Resolves with the pending interrupt, if any.
 */
export async function consumeRun(
  stream: RunStream,
  sink: RunSink,
  acc: { parts: Part[]; usage: PartsUsage },
  /** Resolves when the user stops the run: running tool calls end as stopped and the partial text is kept. */
  stopped: Promise<void> = new Promise(() => {}),
): Promise<{ interrupt?: PendingInterrupt }> {
  const toolEnds: Promise<void>[] = [];

  const messages = (async () => {
    for await (const message of stream.messages) {
      let text = "";
      let reasoning = "";
      // What was streamed so far is a real part of the answer, also when the model call is cut short (stopped).
      const keep = () => {
        if (reasoning) acc.parts.push({ type: "reasoning", text: reasoning });
        if (text) acc.parts.push({ type: "text", text });
        reasoning = "";
        text = "";
      };
      try {
        await Promise.all([
          (async () => {
            for await (const delta of message.reasoning) {
              reasoning += delta;
              await sink.reasoning?.(delta);
            }
          })(),
          (async () => {
            for await (const delta of message.text) {
              text += delta;
              await sink.text?.(delta);
            }
          })(),
        ]);
      } catch (error) {
        keep();
        throw error;
      }
      keep();
      await sink.partsChanged?.();
      const usage = await message.usage;
      acc.usage.input += usage?.input_tokens ?? 0;
      acc.usage.output += usage?.output_tokens ?? 0;
      // `cached`: input tokens the provider read from its prompt cache (chat-model.ts cachingFor).
      await sink.usage?.({ input: usage?.input_tokens ?? 0, output: usage?.output_tokens ?? 0, cached: usage?.input_token_details?.cache_read ?? 0 });
    }
  })();

  const tools = (async () => {
    for await (const call of stream.toolCalls) {
      const part: ToolPart = { type: "tool", id: call.callId, name: call.name, input: clip(call.input), status: "running" };
      acc.parts.push(part);
      await sink.toolStart?.(part);
      toolEnds.push(
        (async () => {
          // A stopped run never hears back from its running tools: they end here as stopped.
          const status = await Promise.race([call.status, stopped.then(() => "stopped")]);
          const error = status === "stopped" ? null : await call.error;
          part.status = status === "finished" && !error ? "done" : "error";
          if (status === "stopped") {
            part.output = "Stopped by the user.";
          } else if (error) {
            part.output = clip(String((error as Error)?.message ?? error));
          } else {
            const raw = await call.output;
            // Taken before clipping, so a long result cannot cut a file off.
            const { text, files } = takeFileMarkers(typeof raw === "string" ? raw : (JSON.stringify(raw) ?? ""));
            part.output = clip(text);
            if (files.length) part.files = files;
          }
          await sink.toolEnd?.(part);
          await sink.partsChanged?.();
        })(),
      );
    }
  })();

  // After a stop the stream may never close by itself: give it a moment, then go on with what was received.
  const grace = stopped.then(() => new Promise<"late">((r) => setTimeout(() => r("late"), 3000)));
  const all = Promise.allSettled([messages, tools, Promise.resolve(stream.output)]);
  const settled = await Promise.race([all, grace.then(() => null)]);
  await Promise.race([Promise.allSettled(toolEnds), grace]);
  if (!settled) return {};
  const failed = settled.find((s): s is PromiseRejectedResult => s.status === "rejected");
  if (failed) throw failed.reason;

  if (await stream.interrupted) {
    const [first] = await stream.interrupts;
    if (first) return { interrupt: { id: first.interruptId, payload: first.payload } };
  }
  return {};
}
