// Helper agents (PLAN.md): eve's built-in root copy (eve docs: Subagents > The
// built-in `agent` tool). Each call is a task: a receipt now, the helper's reply
// later in the same turn. A helper has this agent's instructions, tools and auth
// (so the same mode and approvals), its own session and an empty conversation.
export { default } from "eve/tools/agent";
