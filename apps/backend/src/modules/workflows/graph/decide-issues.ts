import type { DecideConfig } from "./decide-block";

/** What a Decide block still needs before it can run, or null. */
export function decideIssue(config: DecideConfig): string | null {
  if (!config.state.trim()) return "Say what the questions are about (the state).";
  if (config.questions.length === 0) return "Add at least one question.";
  const ids = new Set<string>();
  for (const q of config.questions) {
    if (ids.has(q.id)) return `Two questions are named "${q.id}".`;
    ids.add(q.id);
    if (!q.instructions.trim()) return `Write question "${q.id}".`;
    if (q.type === "choice" && q.choices.length < 2) return `Question "${q.id}" needs at least two choices.`;
    if (q.type === "choice" && new Set(q.choices.map((c) => c.label)).size !== q.choices.length) {
      return `Question "${q.id}" has the same choice twice.`;
    }
    if (q.type === "score" && q.levels.length < 2) return `Question "${q.id}" needs at least two levels.`;
  }
  return null;
}
