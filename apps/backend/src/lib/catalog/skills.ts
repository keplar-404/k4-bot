import type { RoleId } from "../bot-roles";

/**
 * The skills users can install, curated per bot role from the skills.sh directory (https://skills.sh).
 * Picked for: a known publisher, plain instructions that work with this platform's tools (no local CLI logins,
 * no other paid APIs), and real files on skills.sh. Each was checked against the download endpoint when added.
 *
 * Content is fetched from skills.sh's public endpoint (the one its own CLI uses) and, on install, stored as a
 * pinned snapshot: a skill never changes under a user's bot without them reinstalling it.
 */
export interface CatalogSkill {
  /** skills.sh id: "<owner>/<repo>/<skill>". */
  id: string;
  name: string;
  role: Exclude<RoleId, "custom">;
  /** One line for the card (the full description comes from the skill itself). */
  summary: string;
}

export const SKILL_CATALOG: CatalogSkill[] = [
  // Assistant: everyday documents
  { id: "anthropics/skills/pdf", name: "PDF", role: "assistant", summary: "Read, fill, merge, split and create PDF files." },
  { id: "anthropics/skills/docx", name: "Word documents", role: "assistant", summary: "Create and edit .docx files with tracked changes and styles." },
  { id: "anthropics/skills/xlsx", name: "Spreadsheets", role: "assistant", summary: "Build, clean and analyse Excel spreadsheets and formulas." },
  { id: "anthropics/skills/pptx", name: "Presentations", role: "assistant", summary: "Create and edit PowerPoint slide decks." },
  // Advisor: thinking partners
  { id: "anthropics/knowledge-work-plugins/product-brainstorming", name: "Product brainstorming", role: "advisor", summary: "Explore problems and challenge assumptions as a thinking partner." },
  { id: "obra/superpowers/brainstorming", name: "Brainstorming", role: "advisor", summary: "Turn a rough idea into a clear plan through questions, before building." },
  { id: "coreyhaines31/marketingskills/marketing-psychology", name: "Marketing psychology", role: "advisor", summary: "Apply mental models and behavioural science to decisions." },
  { id: "coreyhaines31/marketingskills/content-strategy", name: "Content strategy", role: "advisor", summary: "Decide what content to create and which topics to cover." },
  // Coding
  { id: "mattpocock/skills/tdd", name: "Test-driven development", role: "coding", summary: "Build features and fix bugs test-first (red, green, refactor)." },
  { id: "mattpocock/skills/code-review", name: "Code review", role: "coding", summary: "Review changes against the repo's standards and for correctness." },
  { id: "obra/superpowers/systematic-debugging", name: "Systematic debugging", role: "coding", summary: "Find the root cause of a bug before proposing a fix." },
  { id: "anthropics/skills/frontend-design", name: "Frontend design", role: "coding", summary: "Distinctive, intentional visual design for new or existing UI." },
  { id: "vercel-labs/agent-skills/vercel-react-best-practices", name: "React best practices", role: "coding", summary: "React and Next.js performance guidelines from Vercel." },
  { id: "shadcn-ui/ui/shadcn", name: "shadcn/ui", role: "coding", summary: "Add, compose and style shadcn/ui components." },
  { id: "anthropics/skills/webapp-testing", name: "Web app testing", role: "coding", summary: "Test web apps in a real browser with Playwright." },
  // Research (the Tavily skills use the bots' tavily_* tools by name)
  { id: "tavily-ai/skills/tavily-research", name: "Tavily deep research", role: "research", summary: "Split a question into subtopics, research each, write a cited report." },
  { id: "tavily-ai/skills/tavily-search", name: "Tavily web search", role: "research", summary: "Tavily's own guide to searching, reading pages, mapping and crawling sites." },
  { id: "anthropics/knowledge-work-plugins/knowledge-synthesis", name: "Knowledge synthesis", role: "research", summary: "Merge many sources into one deduplicated, attributed answer." },
  { id: "affaan-m/ecc/literature-review", name: "Literature review", role: "research", summary: "Systematic review: search plan, screening, synthesis, citations." },
  { id: "coreyhaines31/marketingskills/competitor-profiling", name: "Competitor profiling", role: "research", summary: "Research and profile competitors from their websites." },
  { id: "coreyhaines31/marketingskills/customer-research", name: "Customer research", role: "research", summary: "Plan, run and synthesise customer interviews and surveys." },
  // Writing
  { id: "coreyhaines31/marketingskills/copywriting", name: "Copywriting", role: "writing", summary: "Write and improve marketing copy for any page." },
  { id: "hardikpandya/stop-slop/stop-slop", name: "Stop slop", role: "writing", summary: "Remove predictable AI writing patterns from text." },
  { id: "vercel-labs/agent-skills/writing-guidelines", name: "Writing guidelines", role: "writing", summary: "Review docs and prose for voice, tone and style." },
  { id: "coreyhaines31/marketingskills/seo-audit", name: "SEO audit", role: "writing", summary: "Audit and fix a site's SEO issues." },
];

export const catalogSkill = (id: string) => SKILL_CATALOG.find((s) => s.id === id);
