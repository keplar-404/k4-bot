"use client";

// Helper agents (PLAN.md) in the chat: one card per `agent` call. eve docs:
// Frontend > Show subagent progress. useEveAgent({ followAgents: true }) reads each
// helper's own session; agentCallActivity(agent, callId) says which helper session
// and turns a call caused. Requests the helper needs (approvals, questions) are
// relayed to the parent, so OpenRequests answers them; nothing here duplicates them.
import { agentCallActivity } from "eve/client";
import type { EveMessage, EveToolPart, UseEveAgentReturn } from "eve/react";
import { BotIcon, LoaderCircleIcon, MessageSquareTextIcon } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { Streamdown } from "streamdown";
import { Badge } from "@/components/ui/badge";
import {
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceDescription,
	TraceIcon,
	TraceLine,
	TraceTitle,
} from "@/components/ui/trace";
import { useManualOpen } from "@/lib/chat-ui";
import { splitTurn } from "./split-turn";

// Plug-in point: the chat hands its eve store to this module with one call,
// useSubagents(agent), so the chat's markup stays untouched. A helper card deep
// in the Steps reads it back from here.
let source: UseEveAgentReturn | undefined;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
	listeners.add(fn);
	return () => listeners.delete(fn);
};

/** Call once in the chat, next to useEveAgent({ followAgents: true }). */
export function useSubagents(agent: UseEveAgentReturn) {
	useEffect(() => {
		source = agent;
		for (const fn of listeners) fn();
	});
}

const useSource = () =>
	useSyncExternalStore(
		subscribe,
		() => source,
		() => undefined,
	);

type Status = "working" | "done" | "failed" | "waiting" | "cancelled";
const STATUS: Record<
	Status,
	{ label: string; variant: "secondary" | "outline" | "destructive" }
> = {
	working: { label: "Working", variant: "secondary" },
	waiting: { label: "Needs you", variant: "outline" },
	done: { label: "Done", variant: "outline" },
	failed: { label: "Failed", variant: "destructive" },
	cancelled: { label: "Cancelled", variant: "outline" },
};

function statusOf(part: EveToolPart, running: boolean): Status {
	if (part.state === "failed" || part.state === "rejected") return "failed";
	if (part.state === "cancelled") return "cancelled";
	if (part.interaction?.status === "open") return "waiting";
	return running ? "working" : "done";
}

/** The helper's messages for this call (or every message of its session). */
function childMessages(
	agent: UseEveAgentReturn | undefined,
	callId: string,
): EveMessage[] {
	if (!agent) return [];
	const activity = agentCallActivity(agent, callId);
	if (activity.status !== "linked") return [];
	return activity.sessions.flatMap(({ sessionId, turns }) => {
		const observed = agent.agents[sessionId]?.observation;
		if (!observed || observed.status === "not-followed") return [];
		const turnIds = new Set(turns.map((t) => t.turnId));
		return observed.conversation.messages.filter(
			(m) =>
				m.role === "assistant" &&
				(turnIds.size === 0 || turnIds.has(String(m.metadata?.turnId))),
		);
	});
}

const RUNNING = new Set([
	"streaming",
	"requested",
	"approval",
	"running",
	"blocked",
]);

export function SubagentRow({
	part,
	ToolRow,
}: {
	part: EveToolPart;
	/** The chat's own tool row, reused for the helper's steps. */
	ToolRow: (p: { part: EveToolPart }) => React.ReactNode;
}) {
	const running = RUNNING.has(part.state);
	const agent = useSource();
	const [manual, setManual] = useManualOpen(`agent:${part.callId}`);
	const input = (part.input ?? {}) as { message?: unknown; taskId?: unknown };
	const task =
		typeof input.message === "string"
			? input.message
			: part.state === "streaming"
				? part.inputText
				: "";
	const status = statusOf(part, running);
	const messages = childMessages(agent, part.callId);
	const steps = messages.flatMap((m) => splitTurn(m.parts).steps);
	const result =
		typeof part.output === "string"
			? part.output
			: (messages.at(-1) && splitTurn(messages.at(-1)?.parts ?? []).reply) ||
				undefined;
	const tools = steps.filter((s) => s.type === "tool").length;
	return (
		<TraceCollapsible
			open={manual ?? status === "working"}
			onOpenChange={setManual}
			className="rounded-lg border bg-card/50 p-2.5"
		>
			<TraceCollapsibleTrigger>
				<TraceLine status={status === "failed" ? "error" : undefined}>
					<TraceIcon>
						{status === "working" ? (
							<LoaderCircleIcon className="animate-spin" />
						) : (
							<BotIcon />
						)}
					</TraceIcon>
					<TraceTitle>
						{typeof input.taskId === "string" ? "Helper (follow-up)" : "Helper"}
					</TraceTitle>
					<Badge variant={STATUS[status].variant}>{STATUS[status].label}</Badge>
					{tools > 0 && (
						<TraceDescription>
							{tools} step{tools === 1 ? "" : "s"}
						</TraceDescription>
					)}
				</TraceLine>
			</TraceCollapsibleTrigger>
			{task && (
				<p className="mt-1.5 line-clamp-2 pl-6 text-xs text-muted-foreground">
					{task}
				</p>
			)}
			<TraceCollapsibleContent className="mt-2 flex flex-col gap-2 border-l pl-4">
				{steps.map((s, i) =>
					s.type === "tool" ? (
						<ToolRow key={s.callId} part={s} />
					) : s.type === "text" && s.text.trim() ? (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: narration has no id
							key={`t${i}`}
							className="flex gap-2 text-xs text-muted-foreground"
						>
							<MessageSquareTextIcon className="mt-0.5 size-3.5 shrink-0" />
							<p className="min-w-0 whitespace-pre-wrap italic">
								{s.text.trim()}
							</p>
						</div>
					) : null,
				)}
				{status === "working" && steps.length === 0 && (
					<p className="text-xs text-muted-foreground">Starting…</p>
				)}
				{part.error && (
					<p className="text-xs text-destructive">{part.error.message}</p>
				)}
				{result && status !== "working" && (
					<Streamdown className="min-w-0 text-sm leading-relaxed">
						{result}
					</Streamdown>
				)}
			</TraceCollapsibleContent>
		</TraceCollapsible>
	);
}
