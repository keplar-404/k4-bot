import type { Part } from "../agent/parts";

/** The most characters of a tool result kept for older steps in what is pushed live (the saved turn keeps all). */
const OLD_OUTPUT_CHARS = 500;
/** Newest parts always sent whole. */
const RECENT = 4;
const MAX_LIVE_CHARS = 120_000;

/**
 * The turn as it is pushed to the open builder while it grows: the newest steps whole, older tool results shortened,
 * and (for a very long turn) only the newest parts. The full turn is saved in the database and loaded when the run ends.
 */
export function partsForLive(parts: Part[]): Part[] {
  const shaped = parts.map((p, i) =>
    p.type === "tool" && i < parts.length - RECENT && p.output && p.output.length > OLD_OUTPUT_CHARS ? { ...p, output: `${p.output.slice(0, OLD_OUTPUT_CHARS)}…` } : p,
  );
  let out = shaped;
  while (out.length > RECENT && JSON.stringify(out).length > MAX_LIVE_CHARS) out = out.slice(Math.ceil(out.length / 4));
  return out;
}
