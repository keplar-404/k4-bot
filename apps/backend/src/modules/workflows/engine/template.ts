import { FatalBlockError } from "./errors";

/** What a template can read: the trigger's data, earlier blocks' outputs, the run, and (action blocks only) secrets. */
export type RunContext = {
  trigger: unknown;
  steps: Record<string, { output: unknown; error?: string }>;
  run: { id: string; startedAt: string };
  secrets?: Record<string, string>;
};

const REFERENCE = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;
const MAX_REFERENCES = 50;
const MAX_DEPTH = 10;
const MAX_CHARS = 100 * 1024;
/** Path parts that would walk into an object's prototype instead of its data. */
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);

/** The value at a dotted path such as `steps.n1.output.items`, or undefined. Only own properties are followed. */
function lookup(ctx: RunContext, path: string): unknown {
  const parts = path.split(".");
  if (parts.some((part) => FORBIDDEN.has(part))) return undefined;

  let current: unknown = ctx;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    if (!Object.hasOwn(current, part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function asText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Fills in the {{references}} of one string. A string that is exactly one reference gives the raw value (a list
 * stays a list); otherwise each reference is written into the text. A filled-in value is data: it is never read
 * as a template again.
 */
export function resolve(text: string, ctx: RunContext): unknown {
  const matches = [...text.matchAll(REFERENCE)];
  if (matches.length === 0) return text;
  if (matches.length > MAX_REFERENCES) throw new FatalBlockError("Too many references in one field.");

  const [only] = matches;
  if (matches.length === 1 && only![0] === text.trim()) return lookup(ctx, only![1]!);
  return text.replace(REFERENCE, (_match, path: string) => asText(lookup(ctx, path)));
}

/** resolve() on every string inside a value (objects and lists included), with depth and size caps. */
export function resolveDeep<T>(value: T, ctx: RunContext): T {
  const result = resolveValue(value, ctx, 0);
  if (JSON.stringify(result ?? null).length > MAX_CHARS) {
    throw new FatalBlockError("Too much data: the filled-in fields are over 100 KB.");
  }
  return result as T;
}

function resolveValue(value: unknown, ctx: RunContext, depth: number): unknown {
  if (depth > MAX_DEPTH) throw new FatalBlockError("The fields are nested too deeply.");
  if (typeof value === "string") return resolve(value, ctx);
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, ctx, depth + 1));
  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(([key, item]) => [key, resolveValue(item, ctx, depth + 1)]);
    return Object.fromEntries(entries);
  }
  return value;
}
