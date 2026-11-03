"use client";

import type { SubagentStatus } from "@backend/modules/agent/parts";
import {
  CheckIcon,
  CircleAlertIcon,
  CircleDashedIcon,
  Loader2Icon,
} from "lucide-react";

function StatusIcon({ status }: { status: SubagentStatus["status"] }) {
  if (status === "running")
    return <Loader2Icon className="size-3 shrink-0 animate-spin" />;
  if (status === "done")
    return <CheckIcon className="size-3 shrink-0 text-foreground" />;
  if (status === "failed")
    return <CircleAlertIcon className="size-3 shrink-0 text-destructive" />;
  return <CircleDashedIcon className="size-3 shrink-0" />;
}

/** Everything the sub-agent did (its tool calls and messages), folded by default. */
function AgentLog({ log }: { log: string[] }) {
  return (
    <details className="basis-full pl-4">
      <summary className="cursor-pointer select-none hover:text-foreground">
        What it did ({log.length})
      </summary>
      <ol className="mt-1 flex list-decimal flex-col gap-0.5 pl-4">
        {log.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the log is append-only
          <li key={i} className="break-words">
            {line}
          </li>
        ))}
      </ol>
    </details>
  );
}

/** What a sub-agent is doing now, or how it ended. */
function detail(agent: SubagentStatus): string {
  const steps = agent.steps ? ` · ${agent.steps} steps` : "";
  if (agent.status === "failed")
    return `failed${agent.note ? `: ${agent.note}` : ""}`;
  if (agent.status === "running")
    return `${agent.activity ?? "starting"}${steps}`;
  return `${agent.status}${steps}`;
}

/** The sub-agents of a group, each with its live activity (searches, pages, messages to the group). */
export function SubagentList({ agents }: { agents: SubagentStatus[] }) {
  return (
    <ul className="ml-6 flex flex-col gap-1 border-l pl-3 text-xs text-muted-foreground">
      {agents.map((agent) => (
        <li
          key={agent.name}
          className="flex min-w-0 flex-wrap items-center gap-1.5"
        >
          <StatusIcon status={agent.status} />
          <span className="shrink-0 font-medium text-foreground">
            {agent.name}
          </span>
          <span className="min-w-0 truncate" title={detail(agent)}>
            {detail(agent)}
          </span>
          {agent.log?.length ? <AgentLog log={agent.log} /> : null}
        </li>
      ))}
    </ul>
  );
}
