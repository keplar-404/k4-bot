/** A JSON Schema property as Composio sends it (only what the quality checks read). */
export type FieldSchema = {
  type?: string | string[];
  description?: string;
  default?: unknown;
  examples?: unknown[];
  enum?: unknown[];
  file_uploadable?: boolean;
  properties?: Record<string, FieldSchema>;
};

export type FieldProblem = { field: string; problem: "default_wrong_type" | "example_wrong_type" | "no_description" };

const typeOf = (s: FieldSchema) => (Array.isArray(s.type) ? s.type.find((t) => t !== "null") : s.type);

/** Whether a value fits the field's declared type (the builder's placeholder rule uses the same test). */
export function fitsType(s: FieldSchema, v: unknown): boolean {
  if (v === null || v === undefined || v === "") return false;
  if (s.enum?.length) return s.enum.includes(v);
  switch (typeOf(s)) {
    case "integer":
      return Number.isInteger(typeof v === "string" ? Number(v) : v);
    case "number":
      return Number.isFinite(typeof v === "string" ? Number(v) : v);
    case "boolean":
      return typeof v === "boolean" || v === "true" || v === "false";
    case "array":
    case "object":
      return typeof v === "object";
    default:
      return typeof v === "string" || typeof v === "number";
  }
}

/** Problems with one action's or event's inputs: defaults or examples of the wrong type, fields with no description. */
export function inputProblems(properties: Record<string, FieldSchema> = {}): FieldProblem[] {
  return Object.entries(properties).flatMap(([field, s]) => {
    const out: FieldProblem[] = [];
    if (s.default !== undefined && s.default !== null && s.default !== "" && !fitsType(s, s.default)) {
      out.push({ field, problem: "default_wrong_type" });
    }
    if ((s.examples ?? []).some((e) => e !== null && e !== "" && !fitsType(s, e))) out.push({ field, problem: "example_wrong_type" });
    if (!s.description?.trim()) out.push({ field, problem: "no_description" });
    return out;
  });
}
