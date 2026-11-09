import { z } from "zod";

/** One field of a manual trigger's form: what the person (or bot) starting the run fills in. */
export const formField = z.object({
  key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,40}$/),
  label: z.string().max(80).default(""),
  type: z.enum(["text", "number", "yes_no", "list"]).default("text"),
  required: z.boolean().default(false),
  help: z.string().max(200).default(""),
});
/** Started by hand: optional form fields, read as {{trigger.inputs.<key>}}. */
export const manualConfig = z.object({ fields: z.array(formField).max(20).default([]) });

export type FormField = z.infer<typeof formField>;

const YES = new Set(["true", "yes", "1", "on"]);
const NO = new Set(["false", "no", "0", "off", ""]);

/**
 * The run's inputs, typed by the form: numbers become numbers, yes/no becomes true/false, a list becomes a list
 * (from a list, JSON text or comma-separated text). Fields the form does not name pass through unchanged.
 * Returns the problems instead when a required field is empty or a value has the wrong type.
 */
export function readForm(fields: FormField[], raw: Record<string, unknown>): { inputs: Record<string, unknown> } | { problems: string[] } {
  const inputs: Record<string, unknown> = { ...raw };
  const problems: string[] = [];
  for (const f of fields) {
    const name = f.label || f.key;
    const v = raw[f.key];
    const empty = v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (f.required) problems.push(`${name} is required.`);
      continue;
    }
    if (f.type === "number") {
      const n = typeof v === "number" ? v : Number(String(v).trim());
      if (Number.isFinite(n)) inputs[f.key] = n;
      else problems.push(`${name} must be a number.`);
    } else if (f.type === "yes_no") {
      const t = String(v).trim().toLowerCase();
      if (typeof v === "boolean") inputs[f.key] = v;
      else if (YES.has(t) || NO.has(t)) inputs[f.key] = YES.has(t);
      else problems.push(`${name} must be yes or no.`);
    } else if (f.type === "list") {
      inputs[f.key] = Array.isArray(v) ? v : asList(String(v));
    } else {
      inputs[f.key] = typeof v === "string" ? v : JSON.stringify(v);
    }
  }
  return problems.length ? { problems } : { inputs };
}

function asList(text: string): unknown[] {
  if (text.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Read as comma-separated below.
    }
  }
  return text.split(",").map((s) => s.trim()).filter(Boolean);
}
