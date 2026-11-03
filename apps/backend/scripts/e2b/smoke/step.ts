import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const outDir = mkdtempSync(join(tmpdir(), "k4-e2b-"));
export const shot = (name: string) => join(outDir, name);

const results: Array<{ step: string; ok: boolean; ms: number; note: string }> = [];

/** Runs one check, records PASS/FAIL with its time and note; never throws (undefined on failure). */
export async function step<T>(name: string, fn: () => Promise<T>, note?: (v: T) => string) {
  const started = Date.now();
  try {
    const value = await fn();
    results.push({ step: name, ok: true, ms: Date.now() - started, note: note?.(value) ?? "" });
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0]! : String(error);
    results.push({ step: name, ok: false, ms: Date.now() - started, note: message.slice(0, 140) });
    return undefined;
  }
}

/** Prints the table and exits non-zero when any step failed. */
export function report(): never {
  console.log("\nRESULT");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.step.padEnd(44)} ${String(r.ms).padStart(6)}ms  ${r.note}`);
  }
  console.log(`\nScreenshots saved in: ${outDir}`);
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

export const sameImage = (a: Uint8Array, b: Uint8Array) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
