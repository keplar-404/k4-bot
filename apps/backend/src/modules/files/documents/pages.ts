/** Roughly 6k tokens of text per call; longer documents are read in turns. */
export const TEXT_BUDGET = 24_000;
/** Characters per "part" of a text document (plain text, Office documents). */
export const TEXT_PAGE = 8_000;

/** "1,3-5" → [1,3,4,5] within 1..total, in order, without repeats. Empty → every page. */
export function parsePages(spec: string | undefined, total: number): number[] {
  if (!spec?.trim()) return Array.from({ length: total }, (_, i) => i + 1);
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const m = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part);
    if (!m) continue;
    const b = Math.min(Number(m[2] ?? m[1]), total);
    for (let p = Math.max(1, Number(m[1])); p <= b; p++) out.add(p);
  }
  return [...out].sort((x, y) => x - y);
}

/** [1,2,3,7,9,10] → "1-3,7,9-10". */
export function ranges(pages: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    let j = i;
    while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j++;
    out.push(i === j ? `${pages[i]}` : `${pages[i]}-${pages[j]}`);
    i = j;
  }
  return out.join(",");
}

/** Parts of about TEXT_PAGE characters, cut at line breaks (a single huge line is cut where it must be). */
export function textParts(all: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (const line of all.split(/(?<=\n)/)) {
    for (let i = 0; i < line.length; i += TEXT_PAGE) {
      const piece = line.slice(i, i + TEXT_PAGE);
      if (current && current.length + piece.length > TEXT_PAGE) {
        parts.push(current);
        current = "";
      }
      current += piece;
    }
  }
  if (current || parts.length === 0) parts.push(current);
  return parts;
}

/** Letters and digits in a text: a PDF page with almost none is a scan. */
export const letters = (t?: string) => (t ?? "").replace(/[^\p{L}\p{N}]/gu, "").length;
