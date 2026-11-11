/** Words of a search, lowercased, without plural "s" ("emails" finds "email"); short words are noise. */
const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3)
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));

/**
 * Ranks an app's actions by how many words of the query they contain (slug, name, description), best first. A model
 * searches in its own words ("list messages emails"), so matching the whole phrase found nothing; this finds the
 * action that has the most of them.
 */
export function rankActions<T extends { slug: string; name: string; description: string }>(all: T[], query: string, limit = 15): T[] {
  const wanted = [...new Set(words(query))];
  if (wanted.length === 0) return all.slice(0, limit);
  const scored = all
    .map((t, i) => {
      const have = new Set(words(`${t.slug} ${t.name} ${t.description}`));
      // A word in the action's name counts double: "Fetch emails" beats an action that mentions email once.
      const name = new Set(words(`${t.slug} ${t.name}`));
      const score = wanted.reduce((s, w) => s + (have.has(w) ? 1 : 0) + (name.has(w) ? 1 : 0), 0);
      return { t, i, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.slice(0, limit).map((x) => x.t);
}
