import type { StructuredToolInterface } from "@langchain/core/tools";
import { agentUsage } from "../../../../db/schema";
import { connectApps } from "../../mcp";
import type { Group } from "./group";
import { runMember } from "./member";
import { createSkillLoader } from "./skill-loader";
import { CONCURRENCY, MAX_REPORT_CHARS, MEMBER_TIMEOUT_MS, type SubagentToolsOptions } from "./options";
import type { AgentSpec } from "./start";

/** Runs every member (CONCURRENCY at a time), records their reports, files and token use, then closes the group. */
export async function runGroup(o: SubagentToolsOptions, g: Group, agents: AgentSpec[], groupEnd: number, publish: () => Promise<void> | undefined) {
  // Apps the bot is not connected to this run: one connection for the whole group, closed when it ends.
  const wanted = [...new Set(agents.flatMap((a) => a.apps ?? []))].filter((id) => !o.botApps?.readOnly[id]);
  const usage = { input: 0, output: 0 };

  const extra = wanted.length ? await connectApps(o.env, o.userId, o.connectedApps.filter((c) => wanted.includes(c.serverId))) : undefined;
  const appTools = (id: string): StructuredToolInterface[] => o.botApps?.readOnly[id] ?? extra?.readOnly[id] ?? [];

  // At most one live update a second per group: a busy member makes several calls a second.
  let lastPublish = 0;
  const publishSoon = () => {
    if (Date.now() - lastPublish < 1000) return;
    lastPublish = Date.now();
    void publish();
  };

  const skillsFor = createSkillLoader(o);

  const runOne = async (index: number) => {
    const a = agents[index]!;
    const status = g.statuses[index]!;
    const left = groupEnd - Date.now();
    if (left < 45_000) {
      status.status = "failed";
      status.note = "not started: out of time";
      g.reports[index] = `## ${a.name} — not run\nThe group ran out of time before this sub-agent started.`;
      return;
    }
    status.status = "running";
    await publish();
    try {
      const result = await runMember(a, {
        group: g,
        botName: o.botName,
        today: o.today,
        brief: o.brief,
        model: o.createModel(),
        tools: [...o.webTools, ...(a.apps ?? []).flatMap(appTools)],
        skills: await skillsFor(a),
        maxParallelTools: o.maxParallelTools,
        timeoutMs: Math.min(MEMBER_TIMEOUT_MS, left),
        onActivity: (text) => {
          status.activity = text;
          status.steps = (status.steps ?? 0) + 1;
          // Saved with the spawn call, so the chat can show what each member did after the run.
          if (text !== "Thinking") status.log = [...(status.log ?? []), text].slice(-40);
          publishSoon();
        },
      });
      usage.input += result.usage.input;
      usage.output += result.usage.output;
      g.memberFiles.set(a.name, result.files);
      g.reports[index] = `## ${a.name}\n${result.report.length > MAX_REPORT_CHARS ? `${result.report.slice(0, MAX_REPORT_CHARS)}\n…[clipped]` : result.report}`;
      status.status = "done";
      status.activity = undefined;
    } catch (error) {
      const reason = (error as Error)?.name === "TimeoutError" || /abort/i.test(String(error)) ? "timed out" : String((error as Error)?.message ?? error).slice(0, 160);
      status.status = "failed";
      status.activity = undefined;
      status.note = reason;
      g.reports[index] = `## ${a.name} — failed\n${reason}. Do this part yourself or spawn it again with a narrower task.`;
    }
    await publish();
  };

  // A small worker pool: CONCURRENCY at a time, in the order given.
  let next = 0;
  const worker = async () => {
    while (next < agents.length) await runOne(next++);
  };
  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, agents.length) }, worker));
  } finally {
    await extra?.close();
    g.finish();
    if (usage.input + usage.output > 0) {
      // Sub-agents spend the user's daily token budget like the bot does.
      await o.db
        .insert(agentUsage)
        .values({ userId: o.userId, threadId: o.threadId, runId: o.runId, model: o.modelId, inputTokens: usage.input, outputTokens: usage.output })
        .catch((e: unknown) => console.error("[subagents] usage not recorded", e));
    }
  }
}
