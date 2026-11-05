/**
 * Makes a Tavily research report read well in the chat: citations become links to their source, the reference list
 * gets titles and domains instead of bare URLs, and the sources are listed once (Tavily's report often carries its
 * own "References"; then that list is used and no second one is added).
 */
type Source = { title?: string; url: string };

const norm = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
const domain = (url: string) => norm(url).split("/")[0] ?? url;
const label = (s: Source) => (s.title?.trim() || domain(s.url)).replace(/[[\]]/g, "");

/** "[3] https://…" lines (Tavily's References), by number. */
function referenceUrls(body: string): Map<string, string> {
  const refs = new Map<string, string>();
  for (const m of body.matchAll(/^\s*\[(\d+)\]\s*(https?:\/\/\S+)\s*$/gm)) refs.set(m[1]!, m[2]!);
  return refs;
}

/** One reference line: "3. [Title](url) · domain". */
const referenceLine = (n: string | number, s: Source) => `${n}. [${label(s)}](${s.url}) · ${domain(s.url)}`;

export function formatReport(body: string, sources: Source[]): string {
  const titles = new Map(sources.map((s) => [norm(s.url), s.title]));
  const refs = referenceUrls(body);

  // Tavily's own list: rewrite each bare "[n] url" with a title and domain.
  let text = body.replace(/^\s*\[(\d+)\]\s*(https?:\/\/\S+)\s*$/gm, (_, n: string, url: string) => referenceLine(n, { url, title: titles.get(norm(url)) }));
  // A "References"/"Sources" heading written as plain text becomes a heading.
  text = text.replace(/^(References|Sources)\s*$/gm, "## $1");

  // Inline citations "[3]" (not a line's leading "[3] url", not already a link) link to their source.
  const urlOf = (n: string) => refs.get(n) ?? sources[Number(n) - 1]?.url;
  text = text.replace(/(?<![\n[])\[(\d+)\](?!\()/g, (whole, n: string) => {
    const url = urlOf(n);
    return url ? `[[${n}]](${url})` : whole;
  });

  // Only when Tavily gave no list of its own: add one from the sources it returned.
  if (refs.size === 0 && sources.length) text += `\n\n## Sources\n${sources.map((s, i) => referenceLine(i + 1, s)).join("\n")}`;
  return text;
}
