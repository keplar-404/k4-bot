import { entry, loadZip, row, texts } from "./xml";

/**
 * OpenDocument text (.odt) and spreadsheets (.ods) as markdown, from the zip's `content.xml`. Best effort: paragraphs
 * and headings for text; one table per sheet for spreadsheets (repeated empty cells are not expanded).
 */
export async function openDocumentToMarkdown(bytes: Uint8Array, spreadsheet: boolean): Promise<string> {
  const xml = await entry(await loadZip(bytes), "content.xml");
  if (!xml) throw new Error("the file has no content.xml (it may not be an OpenDocument file)");
  if (!spreadsheet) {
    return [...xml.matchAll(/<text:(h|p)\b[^>]*>([\s\S]*?)<\/text:\1>/g)]
      .map((m) => (m[1] === "h" ? "## " : "") + m[2]!.replace(/<[^>]+>/g, ""))
      .map((t) => texts(`<x>${t}</x>`, "x")[0] ?? t)
      .filter((t) => t.trim())
      .join("\n\n");
  }
  const out: string[] = [];
  for (const table of xml.matchAll(/<table:table\b[^>]*table:name="([^"]*)"[^>]*>([\s\S]*?)<\/table:table>/g)) {
    out.push(`## Sheet: ${table[1]}`);
    for (const r of table[2]!.matchAll(/<table:table-row\b[^>]*>([\s\S]*?)<\/table:table-row>/g)) {
      const cells = [...r[1]!.matchAll(/<table:table-cell\b[^>]*?(?:\/>|>([\s\S]*?)<\/table:table-cell>)/g)].map((c) => texts(c[1] ?? "", "text:p").join(" "));
      if (cells.some(Boolean)) out.push(row(cells));
    }
    out.push("");
  }
  return out.join("\n");
}
