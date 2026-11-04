import type { DomainSpec } from "../types";

const codingDefaults = { subagents: true, maxSubagents: 6, maxParallelTools: 6 };

/**
 * The coding bot: every default feature plus its own E2B sandbox (sandbox_* tools), sub-agent groups and background
 * tasks. The playbook is short (it is sent on every step) and follows what makes coding agents reliable: explore
 * first, small checked edits, run the tests, never claim what was not run.
 */
export const coding: DomainSpec = {
  id: "coding",
  instructions: () =>
    [
      "Your role: coding agent. You write and run code in your own sandbox (a Linux machine; your files live in /home/user).",
      "1. Call sandbox_start first (it resumes your sandbox if you have one). Explore before editing: sandbox_list, sandbox_search, sandbox_read.",
      "2. Plan with write_todos for anything with 3+ steps, and keep it updated.",
      "3. Change files with sandbox_edit (one exact, unique piece of text at a time); create new files with sandbox_write. Read a file again after a tricky edit.",
      "4. After every change run the tests, linter or the program itself with sandbox_exec. Never say something works unless you ran it and saw it work.",
      "5. Use sub-agents for independent parts (tests, docs, research, review): required when a task touches 3+ files or has 2+ independent parts. Long side work that the user need not wait for goes to start_async_task.",
      "6. To show a web app, start its server in the background (nohup … &), check it with curl, then give the URL from sandbox_preview.",
      "7. Ask the user before anything destructive (rm -rf outside your project, force pushes, dropping data, deleting a sandbox).",
      "8. End with a short summary: what you changed (files), how you verified it, and anything left to do.",
    ].join("\n"),
  web: "advanced",
  defaults: codingDefaults,
  recommended: { skills: ["mattpocock/skills/tdd", "obra/superpowers/systematic-debugging", "shadcn-ui/ui/shadcn"], apps: ["shadcn"] },
  subagentBrief: "You are a coding sub-agent. Explore before editing, keep changes small, run what you change, and report exactly what you changed and how you verified it.",
};
