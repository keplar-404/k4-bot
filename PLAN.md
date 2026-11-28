1. The user asks for something big.
"Compare 3 CRM tools and tell me which fits my business."

2. The main agent decides to delegate.
- It reads each subagent's description to choose one, or uses the root copy.
- It writes one self-contained task message per subagent, because a subagent never sees the chat: "Research HubSpot pricing, Gmail integration, limits. Return Result/Data/Files/Gaps."
- It starts 3 subagents in parallel. Each call returns a receipt with a taskId right away. eve allows up to 32 at once.

3. The main agent keeps going.
- It does its own part and may tell the user: "I've started 3 helpers…"
- It doesn't have to wait, but its turn can't end while the subagents are working.

4. Each subagent works on its own.
- It has its own session, its own system prompt ("you are a sub-agent; reply to the main agent with Result, Data, Files, Gaps"), and an empty
- It reads each subagent's description to choose one, or uses the root copy.
- It writes one self-contained task message per subagent, because a subagent never sees the chat: "Research HubSpot pricing, Gmail integration, limits. Return Result/Data/Files/Gaps."
- It starts 3 subagents in parallel. Each call returns a receipt with a taskId right away. eve allows up to 32 at once.

3. The main agent keeps going.
- It does its own part and may tell the user: "I've started 3 helpers…"
- It doesn't have to wait, but its turn can't end while the subagents are working.

4. Each subagent works on its own.
- It has its own session, its own system prompt ("you are a sub-agent; reply to the main agent with Result, Data, Files, Gaps"), and an empty conversation.
- It uses its tools: web, apps, its own desktop, files.
- Approvals, questions and sign-ins it needs appear in the user's chat, and the user answers them there.
- It runs with the user's auth, so the mode and permissions are the same.

5. Results come back automatically.
- When a subagent finishes, its final reply arrives as a <task_result status="completed"> block.
- eve wakes the main agent in the same turn. No new message from the user is needed.
- The main agent waits for the rest with eve__task_wait, then reviews, combines and writes one final answer for the user.

6. If something goes wrong:
- A subagent fails: the result comes back with status="failed" and the error, and the main agent reports what's missing.
- A model error: retried up to 3 times automatically.
- A subagent is stuck or no longer needed: the main agent calls eve__task_cancel(taskId).
- The user sends a new message meanwhile: it joins the same turn, and the agent sees it alongside the results.

7. Follow-ups.
- A finished subagent stays idle with its memory intact.
- "Dig deeper on HubSpot": the main agent calls the same subagent with its taskId, and it continues from where it left off.
- A [Tasks] note keeps the main agent aware of which subagents are working or idle.
- Subagents shut down when the chat session ends.

8. Cost.
- Each subagent's token use counts toward the chat's budget.
- A subagent can't ask the user to raise the limit, so if it hits the limit it fails with SESSION_USAGE_LIMIT_REACHED.

---

In one line: the main agent delegates, keeps working, eve brings each result back automatically, and the main agent reviews and sends one final answer, all in the same turn.
