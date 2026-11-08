const SECRET_REFERENCE = /\{\{\s*secrets\.([A-Z][A-Z0-9_]{1,40})\s*\}\}/g;
/** Shorter values would corrupt ordinary text ("ab" appears everywhere), so they are not redacted. */
const MIN_REDACT_LENGTH = 4;

/** The secret names a value refers to as {{secrets.NAME}}, each once, in the order first used. */
export function secretNamesIn(value: unknown): string[] {
  const text = JSON.stringify(value ?? null);
  const names = [...text.matchAll(SECRET_REFERENCE)].map((match) => match[1]!);
  return [...new Set(names)];
}

/**
 * Replaces every decrypted secret value, in any string inside `value`, with [secret:NAME], before it is stored,
 * shown or returned.
 *
 * shortcut: matches the literal value only (not a base64 or URL-encoded copy of it); upgrade by also redacting
 * encoded forms if a block is expected to echo them.
 */
export function redact<T>(value: T, secrets: Record<string, string>): T {
  // Longest first, so a secret that contains another one is replaced whole.
  const known = Object.entries(secrets)
    .filter(([, secret]) => secret.length >= MIN_REDACT_LENGTH)
    .sort((a, b) => b[1].length - a[1].length);
  if (known.length === 0) return value;

  const scrub = (item: unknown): unknown => {
    if (typeof item === "string") {
      let text = item;
      for (const [name, secret] of known) text = text.replaceAll(secret, `[secret:${name}]`);
      return text;
    }
    if (Array.isArray(item)) return item.map(scrub);
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item).map(([key, inner]) => [key, scrub(inner)]));
    }
    return item;
  };
  return scrub(value) as T;
}
