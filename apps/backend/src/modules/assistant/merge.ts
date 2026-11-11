const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Merges a settings patch into a block's current settings, level by level: changing one argument of an app action keeps
 * its other arguments. Lists and plain values in the patch replace what was there. `__proto__` and friends are skipped.
 */
export function mergeSettings(current: Record<string, unknown> | undefined, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const old = out[key];
    out[key] = isObject(old) && isObject(value) ? mergeSettings(old, value) : value;
  }
  return out;
}
