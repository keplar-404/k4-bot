import { choice, noul, score, TypeSafeClient } from "@typesafe-ai/sdk";
import type { DecideQuestion } from "../workflows/graph/decide-block";

/** One answer as stored in a run: the fields of the question's type, plus a confidence when the model reports one. */
export type DecisionAnswer = {
  type: DecideQuestion["type"];
  noul?: number;
  choice?: string;
  score?: number;
  confidence?: number | null;
  probabilities?: Record<string, number> | number[];
};

const clients = new Map<string, TypeSafeClient>();
/** One client per key per isolate. Compression is off: zstd needs Node's zlib, which Workers do not promise. */
function clientFor(apiKey: string) {
  let client = clients.get(apiKey);
  if (!client) clients.set(apiKey, (client = new TypeSafeClient({ apiKey, compression: false, timeout: 30_000 })));
  return client;
}

/** A question in the SDK's shape (its helpers validate the criteria shapes before anything is sent). */
function toSdk(q: DecideQuestion) {
  if (q.type === "noul") {
    return q.yes || q.no ? noul(q.instructions, { true: q.yes || "Yes.", false: q.no || "No." }) : noul(q.instructions);
  }
  if (q.type === "choice") {
    return choice(q.instructions, Object.fromEntries(q.choices.map((c) => [c.label, c.description || null])));
  }
  return score(q.instructions, q.levels as [string, string, ...string[]]);
}

/**
 * Asks TypeSafe's decision model every question about `state` in one request (they are answered independently) and
 * returns the typed answers by question id, the concrete model version, and token usage.
 */
export async function decide(apiKey: string, model: string, state: string, questions: DecideQuestion[]) {
  const response = await clientFor(apiKey).systemOne({
    model,
    state,
    questions: Object.fromEntries(questions.map((q) => [q.id, toSdk(q)])),
  });
  const raw = response as unknown as {
    model?: string;
    answers: Record<string, Record<string, unknown>>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const answers: Record<string, DecisionAnswer> = {};
  for (const q of questions) {
    const a = raw.answers[q.id] ?? {};
    answers[q.id] = {
      type: q.type,
      ...(typeof a.noul === "number" ? { noul: a.noul } : {}),
      ...(typeof a.choice === "string" ? { choice: a.choice } : {}),
      ...(typeof a.score === "number" ? { score: a.score } : {}),
      ...("confidence" in a ? { confidence: (a.confidence as number | null) ?? null } : {}),
      ...(a.probabilities ? { probabilities: a.probabilities as DecisionAnswer["probabilities"] } : {}),
    };
  }
  return { model: raw.model ?? model, answers, usage: { input: raw.usage?.input_tokens ?? 0, output: raw.usage?.output_tokens ?? 0 } };
}
