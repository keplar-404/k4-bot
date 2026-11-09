import type { WorkflowNode } from "../graph/schema";
import { FatalBlockError } from "./errors";
import { asList } from "./list-ops";
import { resolve, resolveDeep, type RunContext } from "./template";

type SetConfig = Extract<WorkflowNode, { kind: "logic.set" }>["config"];
type Field = SetConfig["fields"][number];

const YES = new Set(["true", "yes", "1", "on"]);
const NO = new Set(["false", "no", "0", "off", ""]);

/** One field's value as its type. Text that cannot be read as that type fails the block with the field's name. */
export function typed(field: Field, value: unknown): unknown {
  if (field.type === "text") return value;
  const text = typeof value === "string" ? value.trim() : null;
  if (field.type === "number") {
    const n = typeof value === "number" ? value : Number(text ?? Number.NaN);
    if (text === "" || !Number.isFinite(n)) throw new FatalBlockError(`${field.key} must be a number.`);
    return n;
  }
  if (field.type === "yes_no") {
    if (typeof value === "boolean") return value;
    const t = String(value).trim().toLowerCase();
    if (YES.has(t) || NO.has(t)) return YES.has(t);
    throw new FatalBlockError(`${field.key} must be yes or no.`);
  }
  if (field.type === "list") {
    if (Array.isArray(value)) return value;
    if (text?.startsWith("[")) return asList(text, field.key);
    return (text ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (value && typeof value === "object") return value;
  try {
    const parsed = JSON.parse(text ?? "");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // Reported below.
  }
  throw new FatalBlockError(`${field.key} must be an object ({"a": 1}).`);
}

/** The Set block's output: the base object (when given) with these fields set on it. */
export function runSet(config: SetConfig, ctx: RunContext) {
  const base = config.base.trim() ? resolve(config.base, ctx) : {};
  if (!base || typeof base !== "object" || Array.isArray(base)) throw new FatalBlockError("“Start from” must be an object from an earlier step.");
  const fields = config.fields.map((f) => [f.key, typed(f, resolveDeep(f.value, ctx))]);
  return { ...(base as object), ...Object.fromEntries(fields) };
}
