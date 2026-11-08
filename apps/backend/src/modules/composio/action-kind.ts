/** Read/write classification of a Composio action. Unknown means write: being wrong only costs one approval click. */
const READ_VERBS = /^(GET|LIST|SEARCH|FIND|FETCH|READ|RETRIEVE|QUERY|DESCRIBE|COUNT|CHECK|LOOKUP|VIEW|EXPORT)_/;
const WRITE_TAGS = ["createHint", "updateHint", "destructiveHint"];

/** `tags` are Composio's own hints on the tool (a string list); without a verdict, the verb after the app prefix decides. */
export function isRead(slug: string, toolkit: string, tags: string[] = []): boolean {
  if (tags.some((t) => WRITE_TAGS.includes(t))) return false;
  if (tags.includes("readOnlyHint")) return true;
  const prefix = `${toolkit.toUpperCase()}_`;
  return slug.startsWith(prefix) && READ_VERBS.test(slug.slice(prefix.length));
}
