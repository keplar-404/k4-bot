/** Words Composio writes in lower case that read as acronyms. */
const ACRONYMS = new Set([
  "ai",
  "crm",
  "seo",
  "hr",
  "erp",
  "cms",
  "sms",
  "api",
  "mcp",
  "it",
  "iot",
  "ats",
  "bi",
  "llm",
  "ui",
  "ux",
  "pdf",
  "sql",
  "saas",
  "devops",
]);

/** "crm" → "CRM", "ai agents" → "AI Agents", "Images & Design" stays as is. */
export function categoryLabel(name: string): string {
  return name
    .split(/(\s+|\/|-)/)
    .map((w) =>
      ACRONYMS.has(w.toLowerCase())
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join("");
}
