import { z } from "zod";
import type { AnswerField } from "../../graph/event-ai-blocks";

/** The answer fields the user built, as the zod object the model is forced to fill (every field required). */
export function answerSchema(fields: AnswerField[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) {
    const choices = f.choices.map((c) => c.trim()).filter(Boolean);
    const base =
      f.type === "number"
        ? z.number()
        : f.type === "boolean"
          ? z.boolean()
          : f.type === "list"
            ? z.array(z.string())
            : f.type === "enum" && choices.length >= 2
              ? z.enum(choices as [string, ...string[]])
              : z.string();
    shape[f.name] = f.description ? base.describe(f.description) : base;
  }
  return z.object(shape);
}
