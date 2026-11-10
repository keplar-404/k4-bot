import type { BlockBody } from "../blocks";
import { LIST_OPS } from "../settings/list-ops";
import type { JsonSchema } from "../settings/tools-api";

const prop = (type: string, description: string): JsonSchema => ({
  type,
  description,
});
const obj = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: "object",
  properties,
});

/** A Set field's type as JSON Schema. */
const SET_TYPES: Record<string, string> = {
  text: "string",
  number: "number",
  boolean: "boolean",
  list: "array",
  object: "object",
};

/** A Decide block's outputs, from its own questions: one field per answer (and its confidence). */
function decideSchema(
  block: Extract<BlockBody, { kind: "ai.decide" }>,
): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  for (const q of block.config.questions) {
    const field =
      q.type === "noul" ? "noul" : q.type === "choice" ? "choice" : "score";
    properties[`answers.${q.id}.${field}`] = prop(
      q.type === "choice" ? "string" : "number",
      q.type === "noul"
        ? `Probability of yes (0–1): ${q.instructions}`
        : q.type === "choice"
          ? `The chosen label: ${q.instructions}`
          : `Expected value 0–1 (not a level): ${q.instructions}`,
    );
    if (q.type !== "noul")
      properties[`answers.${q.id}.confidence`] = prop(
        "number",
        "How sure (0–1)",
      );
  }
  return obj(properties);
}

/**
 * What a built-in block outputs, read from its own settings, so the data picker of the blocks after it lists real
 * fields (the Set block's own field names, a form's questions, a Decide block's answers…). Must match the engine
 * (apps/backend/src/modules/workflows/engine). null for blocks with no known shape (app blocks load theirs).
 */
export function builtinSchema(block: BlockBody): JsonSchema | null {
  switch (block.kind) {
    case "logic.set":
      return obj(
        Object.fromEntries(
          block.config.fields
            .filter((f) => f.key.trim())
            .map((f) => [
              f.key,
              prop(SET_TYPES[f.type] ?? "string", `Set here: ${f.value}`),
            ]),
        ),
      );
    case "trigger.manual":
      return obj(
        Object.fromEntries(
          (block.config.fields ?? [])
            .filter((f) => f.key)
            .map((f) => [
              f.key,
              prop(
                SET_TYPES[f.type] ?? "string",
                `Asked in the run form: ${f.label}`,
              ),
            ]),
        ),
      );
    case "ai.decide":
      return decideSchema(block);
    case "action.http":
      return obj({
        status: prop("number", "The HTTP status, e.g. 200"),
        body: prop(
          block.config.expect === "json" ? "object" : "string",
          "What the service answered",
        ),
        headers: prop("object", "Response headers (content-type, length)"),
      });
    case "ai.bot":
      return obj(
        block.config.output === "json"
          ? {
              json: prop("object", "The bot's answer as JSON"),
              used: prop("array", "Tools it used"),
            }
          : {
              text: prop("string", "The bot's answer"),
              used: prop("array", "Tools it used"),
            },
      );
    case "action.code":
      return obj({
        result: prop("object", "What the code returned"),
        logs: prop("string", "What it printed (console.log)"),
      });
    case "logic.if":
      return obj({ result: prop("boolean", "Whether the conditions held") });
    case "logic.filter":
      return obj({ passed: prop("boolean", "Whether the run went on") });
    case "logic.switch":
      return obj({
        route: prop("string", "The path taken"),
        label: prop("string", "Its name"),
      });
    case "logic.format":
      return obj({ result: prop("string", "The formatted value") });
    case "logic.list": {
      const out =
        LIST_OPS.find((o) => o.op === block.config.operation)?.out ?? "";
      return out.startsWith("items")
        ? obj({ items: prop("array", out) })
        : obj({ result: prop("number", out) });
    }
    case "logic.merge":
      return block.config.mode === "append" || block.config.mode === "by_key"
        ? obj({ items: prop("array", "The merged list") })
        : obj({ result: prop("object", "The merged value") });
    default:
      return null;
  }
}
