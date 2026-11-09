import { z } from "zod";

/** Limits from TypeSafe's API (choice: 1–255 options, score: 1–10 levels) and this app's own caps. */
export const DECIDE_LIMITS = { questions: 16, choices: 50, levels: 10, stateChars: 20_000 } as const;

const text = (max: number) => z.string().max(max);
const id = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);

/**
 * One typed question to the decision model (TypeSafe Jev):
 * - noul: a yes/no question; the answer is the probability of yes (0–1). Optional `yes`/`no` say what counts.
 * - choice: picks one label of `choices`; the answer has the label, its confidence and every label's probability.
 * - score: grades against ordered `levels` (lowest first); the answer is an expected value (0 = lowest, 1 = highest).
 */
export const decideQuestion = z.object({
  id,
  type: z.enum(["noul", "choice", "score"]),
  instructions: text(2000),
  yes: text(500).optional(),
  no: text(500).optional(),
  choices: z
    .array(z.object({ label: z.string().regex(/^[A-Za-z0-9_ -]{1,40}$/), description: text(500).default("") }))
    .max(DECIDE_LIMITS.choices)
    .default([]),
  levels: z.array(text(300)).max(DECIDE_LIMITS.levels).default([]),
});

/**
 * Decide (Jev): asks TypeSafe's decision model typed questions about `state` and returns calibrated probabilities
 * instead of text. Route on the answers with If blocks using ranges (a score is an average, not a level).
 */
export const decideConfig = z.object({
  model: z
    .string()
    .regex(/^[a-z0-9][a-z0-9._-]{0,60}$/)
    .default("jev-latest"),
  state: text(DECIDE_LIMITS.stateChars).default(""),
  questions: z.array(decideQuestion).max(DECIDE_LIMITS.questions).default([]),
});

export type DecideConfig = z.infer<typeof decideConfig>;
export type DecideQuestion = z.infer<typeof decideQuestion>;
