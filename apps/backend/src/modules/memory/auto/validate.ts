/** Text that looks like a secret: never stored in a memory (both are sent to the model with every call). */
const SECRET = [
  /\b(?:sk|pk|rk|ghp|gho|xox[abpr]|AKIA|AIza)[-_A-Za-z0-9]{12,}/, // common API key shapes
  /\b(?:password|passcode|api[_ -]?key|secret|token)\s*[:=]\s*\S{6,}/i,
  /\b(?:\d[ -]?){13,19}\b/, // card-like numbers
  /\b[A-Za-z0-9+/_-]{40,}={0,2}\b/, // long opaque strings (keys, tokens)
];

export const looksSecret = (text: string) => SECRET.some((re) => re.test(text));

/**
 * Whether a proposed memory text may replace the current one: different, within the size cap, no secrets, and it
 * does not silently drop most of what was there (an update should keep what is still true).
 */
export function acceptable(next: string | null | undefined, current: string, max: number): next is string {
  if (typeof next !== "string") return false;
  const text = next.trim();
  if (!text || text === current.trim() || text.length > max) return false;
  if (looksSecret(text)) return false;
  return current.trim().length < 200 || text.length >= current.trim().length * 0.5;
}
