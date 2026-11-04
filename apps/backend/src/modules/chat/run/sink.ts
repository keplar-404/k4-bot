import { Command } from "@langchain/langgraph";
import type { ComputerStub } from "../../computer/sandbox-backend";
import type { FileRef, SubagentStatus } from "../../agent/parts";
import type { RunSink } from "../../agent/run-stream";
import { formatBytes } from "../../files";
import { deepResearchQuestion, researchInstruction } from "../commands";
import { describeActivity } from "./activity";
import type { createRecorder } from "./recorder";
import type { ChatRunParams, Publish } from "./types";

/** Where the agent's live output goes: batched tokens, tool events, the computer's Activity feed, saved parts. */
export function createSink(
  rec: ReturnType<typeof createRecorder>,
  publish: Publish,
  stub: ComputerStub | undefined,
  botId: string,
  /** The last sub-agent statuses per spawn/wait call: saved with the part, so the list stays after the run and a reload. */
  progress: Map<string, SubagentStatus[]>,
  /** After each model call: the context meter (usage-events.ts). */
  onUsage: NonNullable<RunSink["usage"]>,
): RunSink {
  return {
    text: (delta) => rec.tokens.push(delta),
    reasoning: (delta) => rec.thoughts.push(delta),
    toolStart: async (part) => {
      await rec.flushAll();
      await publish("tool.start", { id: part.id, name: part.name, input: part.input });
      const line = describeActivity(part.name, part.input);
      if (line) await stub?.logActivity(botId, line).catch(() => undefined);
    },
    toolEnd: (part) => {
      const agents = progress.get(part.id);
      if (agents) part.agents = agents;
      return publish("tool.end", { id: part.id, status: part.status, output: part.output, files: part.files, agents });
    },
    partsChanged: rec.saveProgress,
    usage: onUsage,
  };
}

/**
 * First slice of a new run sends the user's message; later slices resume the checkpoint (`null`), or answer the
 * question the agent asked (`Command({ resume })`).
 */
export function agentInput(params: ChatRunParams, attached: FileRef[], slice: number, resume: unknown) {
  if (resume !== undefined) return new Command({ resume });
  if (slice > 0) return null;
  // The summarizer has already run when the model sees this (see middleware/stack.ts), so it only confirms.
  if (params.compact) {
    const confirm = "[The user ran /compact: the conversation so far was summarized to free context.] Reply in one or two short sentences: confirm it, and say in a few words what you still remember.";
    return { messages: [{ role: "user", content: confirm }], skillsMetadata: null };
  }
  const question = params.research ? deepResearchQuestion(params.content) : null;
  if (question) return { messages: [{ role: "user", content: researchInstruction(question) }], skillsMetadata: null };
  // Attached files are listed under the message, so the model knows their ids.
  const content = attached.length
    ? `${params.content}\n\n[Attached files]\n${attached.map((f) => `- "${f.name}" (${f.mimeType}, ${formatBytes(f.size)}, file id ${f.id})`).join("\n")}`
    : params.content;
  // A new message also clears the cached skill list, so skills added to or removed from the bot since the
  // last message are seen (Deep Agents keeps the list in the thread's state once loaded).
  return { messages: [{ role: "user", content }], skillsMetadata: null };
}
