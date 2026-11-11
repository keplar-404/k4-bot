type Schema = {
  type?: string | string[];
  description?: string;
  title?: string;
  enum?: unknown[];
  default?: unknown;
  examples?: unknown[];
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  anyOf?: Schema[];
  deprecated?: boolean;
  file_uploadable?: boolean;
};

export type FieldInfo = {
  name: string;
  type: string;
  required: boolean;
  /** The app's own helper text for this input, trimmed. */
  help: string;
  choices?: unknown[];
  default?: unknown;
  example?: unknown;
  /** An object, or a list of objects: its own fields, one level down. */
  fields?: FieldInfo[];
};

const MAX_HELP = 300;
const MAX_CHOICES = 15;

function typeOf(s: Schema): string {
  const t = Array.isArray(s.type) ? s.type.find((x) => x !== "null") : s.type;
  if (t) return t === "array" && s.items ? `list of ${typeOf(s.items)}` : t;
  const inner = s.anyOf?.map(typeOf).find((x) => x !== "null");
  return inner ?? (s.properties ? "object" : "any");
}

/** The nested schema of an object, or of a list's items, if it has fields of its own. */
const childrenOf = (s: Schema): Schema | undefined => {
  if (s.properties) return s;
  if (s.items?.properties) return s.items;
  return s.anyOf?.map(childrenOf).find(Boolean);
};

/**
 * An app action's or event's input schema as a short list of fields, the way the builder's settings form shows them:
 * name, type, required, the app's helper text, choices, default, an example. Deprecated inputs are left out. The raw
 * JSON Schema is large and full of noise; this is what a model needs to fill the inputs in.
 */
export function describeFields(schema: Schema | undefined, depth = 0): FieldInfo[] {
  const props = schema?.properties ?? {};
  const required = new Set(schema?.required ?? []);
  return Object.entries(props)
    .filter(([, s]) => !s.deprecated)
    .map(([name, s]) => {
      const kids = depth < 1 ? childrenOf(s) : undefined;
      const choices = s.enum ?? s.anyOf?.find((a) => a.enum)?.enum;
      const info: FieldInfo = {
        name,
        type: typeOf(s),
        required: required.has(name),
        help: (s.description ?? s.title ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_HELP),
      };
      if (choices?.length) info.choices = choices.slice(0, MAX_CHOICES);
      if (s.default !== undefined) info.default = s.default;
      if (s.examples?.length) info.example = s.examples[0];
      if (kids) info.fields = describeFields(kids, depth + 1);
      return info;
    })
    // What must be filled in comes first.
    .sort((a, b) => Number(b.required) - Number(a.required));
}

/**
 * The field paths of a real output, the way a later block reads them ("messages.0.subject"), with the type of each
 * value, so the model sees which {{steps.<id>.output.<path>}} exist. Lists show their first item. Values are not kept.
 */
export function pathsOf(value: unknown, max = 60): string[] {
  const out: string[] = [];
  const walk = (v: unknown, path: string, depth: number) => {
    if (out.length >= max) return;
    if (Array.isArray(v)) {
      if (path) out.push(`${path} (list of ${v.length})`);
      if (v.length > 0 && depth < 5) walk(v[0], path ? `${path}.0` : "0", depth + 1);
    } else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k, depth + 1);
    } else if (path) {
      out.push(`${path} (${v === null ? "empty" : typeof v})`);
    }
  };
  walk(value, "", 0);
  return out;
}
