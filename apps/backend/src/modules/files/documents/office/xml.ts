import JSZip from "jszip";

/** Office files are zips of XML. These helpers read them without a DOM (Workers have none). */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** XML text → plain text: named and numeric entities decoded. */
export const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1]?.toLowerCase() === "x" ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e] ?? all),
  );

/** The value of one attribute in an element's attribute text (`name="…"`), decoded. */
export const attr = (attrs: string, name: string) => {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs);
  return m ? decode(m[1]!) : undefined;
};

/** Every `<tag>…</tag>` text inside `xml`, in order (e.g. all `a:t` runs of a slide). */
export const texts = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => decode(m[1]!));

export const loadZip = (bytes: Uint8Array) => JSZip.loadAsync(bytes);

/** A zip entry as text, or "" when the file is not there. */
export const entry = async (zip: JSZip, path: string) => (zip.files[path] ? await zip.files[path]!.async("text") : "");

/** Entries matching `pattern` (with one number group), sorted by that number: slide1, slide2, … slide10. */
export const numbered = (zip: JSZip, pattern: RegExp) =>
  Object.keys(zip.files)
    .map((name) => ({ name, n: Number(pattern.exec(name)?.[1] ?? Number.NaN) }))
    .filter((e) => !Number.isNaN(e.n))
    .sort((a, b) => a.n - b.n);

/** Markdown table row; pipes in cells are escaped. */
export const row = (cells: string[]) => `| ${cells.map((c) => c.replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`;
