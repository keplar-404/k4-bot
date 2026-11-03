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
): Promise<{ interrupt?: PendingInterrupt }> {
  const toolEnds: Promise<void>[] = [];

  const messages = (async () => {
    for await (const message of stream.messages) {
      let text = "";
      let reasoning = "";
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
      if (reasoning) acc.parts.push({ type: "reasoning", text: reasoning });
      if (text) acc.parts.push({ type: "text", text });
      await sink.partsChanged?.();
      const usage = await message.usage;
      acc.usage.input += usage?.input_tokens ?? 0;
      acc.usage.output += usage?.output_tokens ?? 0;
      await sink.usage?.({ input: usage?.input_tokens ?? 0, output: usage?.output_tokens ?? 0 });
    }
  })();

  const tools = (async () => {
    for await (const call of stream.toolCalls) {
      const part: ToolPart = { type: "tool", id: call.callId, name: call.name, input: clip(call.input), status: "running" };
      acc.parts.push(part);
      await sink.toolStart?.(part);
      toolEnds.push(
        (async () => {
          const status = await call.status;
          const error = await call.error;
          part.status = status === "finished" && !error ? "done" : "error";
          if (error) {
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

  const settled = await Promise.allSettled([messages, tools, Promise.resolve(stream.output)]);
  await Promise.allSettled(toolEnds);
  const failed = settled.find((s): s is PromiseRejectedResult => s.status === "rejected");
  if (failed) throw failed.reason;

  if (await stream.interrupted) {
    const [first] = await stream.interrupts;
    if (first) return { interrupt: { id: first.interruptId, payload: first.payload } };
  }
  return {};
}
