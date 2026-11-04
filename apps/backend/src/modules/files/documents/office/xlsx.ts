import type JSZip from "jszip";
import { attr, entry, loadZip, numbered, row, texts } from "./xml";

const MAX_ROWS = 200;
const MAX_COLS = 30;

/** "A" → 0, "Z" → 25, "AA" → 26. */
export const columnIndex = (letters: string) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** The value of one `<c>` cell: shared string, inline string, boolean, or the raw number/formula result. */
function cellValue(attrs: string, body: string, shared: string[]): string {
  const type = attr(attrs, "t");
  if (type === "inlineStr") return texts(body, "t").join("");
  const v = texts(body, "v")[0] ?? "";
  if (type === "s") return shared[Number(v)] ?? "";
  if (type === "b") return v === "1" ? "TRUE" : "FALSE";
  return v;
}

/** One sheet as rows of cells, each cell at its own column (empty cells keep their place). */
function sheetRows(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const c of r[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(c[1]!, "r");
      const col = ref ? columnIndex(/^[A-Z]+/.exec(ref)?.[0] ?? "A") : cells.length;
      while (cells.length < col) cells.push("");
      cells[col] = cellValue(c[1]!, c[2] ?? "", shared);
    }
    rows.push(cells);
  }
  return rows;
}

async function sharedStrings(zip: JSZip) {
  const xml = await entry(zip, "xl/sharedStrings.xml");
  // A shared string can be split into rich-text runs: all its <t> parts together.
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]!, "t").join(""));
}

/** An .xlsx workbook as markdown: one table per sheet, capped at MAX_ROWS × MAX_COLS with a note. */
export async function xlsxToMarkdown(bytes: Uint8Array): Promise<string> {
  const zip = await loadZip(bytes);
  const shared = await sharedStrings(zip);
  const names = [...(await entry(zip, "xl/workbook.xml")).matchAll(/<sheet\b([^>]*)\/?>/g)].map((m) => attr(m[1]!, "name") ?? "");
  const out: string[] = [];
  for (const [i, sheet] of numbered(zip, /^xl\/worksheets\/sheet(\d+)\.xml$/).entries()) {
    const rows = sheetRows(await entry(zip, sheet.name), shared).filter((r) => r.some(Boolean));
    out.push(`## Sheet: ${names[i] || `Sheet ${i + 1}`}`);
    const width = Math.min(MAX_COLS, Math.max(1, ...rows.map((r) => r.length)));
    for (const [n, r] of rows.slice(0, MAX_ROWS).entries()) {
      out.push(row(Array.from({ length: width }, (_, k) => r[k] ?? "")));
      if (n === 0) out.push(row(Array.from({ length: width }, () => "---")));
    }
    if (rows.length > MAX_ROWS) out.push(`[${rows.length} rows; the first ${MAX_ROWS} are shown]`);
    if (rows.some((r) => r.length > MAX_COLS)) out.push(`[only the first ${MAX_COLS} columns are shown]`);
    out.push("");
  }
  return out.join("\n");
}
