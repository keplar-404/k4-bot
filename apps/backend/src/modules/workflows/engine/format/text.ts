const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const URL_RE = /https?:\/\/[^\s<>"')]+/;
const NUMBER = /-?\d+(?:[.,]\d+)?/;

/** Text operations. `o` holds the operation's options as text. */
export function formatText(op: string, input: string, o: Record<string, string>): unknown {
  switch (op) {
    case "uppercase":
      return input.toUpperCase();
    case "lowercase":
      return input.toLowerCase();
    case "capitalize":
      return input.toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());
    case "trim":
      return input.trim().replace(/\s+/g, " ");
    case "replace":
      // Plain text, every occurrence: no patterns, so nothing a user types can hang the run.
      return o.find ? input.split(o.find).join(o.replace ?? "") : input;
    case "split":
      return input
        .split(o.separator || ",")
        .map((s) => s.trim())
        .filter(Boolean);
    case "truncate": {
      const n = Math.max(1, Number.parseInt(o.length ?? "100", 10) || 100);
      return input.length > n ? `${input.slice(0, n).trimEnd()}…` : input;
    }
    case "extract_email":
      return input.match(EMAIL)?.[0] ?? "";
    case "extract_url":
      return input.match(URL_RE)?.[0] ?? "";
    case "extract_number": {
      const m = input.match(NUMBER)?.[0];
      return m === undefined ? null : Number(m.replace(",", "."));
    }
    default:
      return undefined;
  }
}
