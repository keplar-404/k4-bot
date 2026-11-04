export interface PdfComplexity {
  complex: boolean;
  reasons: string[];
}

const MATH_CHARS = /[∑∫√≤≥≠±πθλ∞^_{}]/g;
const MATH_TOKENS = /\\frac|\\sum|\\int/g;
const BROKEN = /\(cid:|�/g;

/** Decides from the pages already read; no extra network call. */
export function assessComplexity(input: {
  texts: Map<number, string>;
  shown: number[];
  scans: number[];
  figures: Map<number, number>;
}): PdfComplexity {
  const reasons: string[] = [];
  const shown = input.shown.length || 1;
  // mostly scanned pages
  if (input.scans.length / shown >= 0.3) reasons.push("mostly scanned pages");
  // picture-heavy layout
  const totalFigures = [...input.figures.values()].reduce((a, b) => a + b, 0);
  const avgFigures = totalFigures / shown;
  const avgLetters = [...input.shown.map((p) => (input.texts.get(p) ?? "").replace(/[^\p{L}\p{N}]/gu, "").length)].reduce((a, b) => a + b, 0) / shown;
  if (avgFigures >= 1 && avgLetters < 600) reasons.push("picture-heavy layout");
  // math density
  let mathCount = 0;
  for (const p of input.shown) {
    const t = input.texts.get(p) ?? "";
    mathCount += (t.match(MATH_CHARS) ?? []).length + (t.match(MATH_TOKENS) ?? []).length;
  }
  if (mathCount / shown >= 20) reasons.push("math notation");
  // broken font encoding
  let brokenCount = 0;
  for (const p of input.shown) {
    const t = input.texts.get(p) ?? "";
    brokenCount += (t.match(BROKEN) ?? []).length;
  }
  if (brokenCount >= 5) reasons.push("broken font encoding");
  // table density
  let tableLines = 0;
  let totalLines = 0;
  for (const p of input.shown) {
    const t = input.texts.get(p) ?? "";
    for (const line of t.split("\n")) {
      totalLines++;
      if ((line.match(/  +/g) ?? []).length >= 3 || line.includes("|")) tableLines++;
    }
  }
  if (totalLines > 0 && tableLines / totalLines >= 0.3) reasons.push("complex tables");
  return { complex: reasons.length > 0, reasons };
}