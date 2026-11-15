"use client";

import type {
	EveMessage,
	EveMessagePart,
	EveToolPart,
	UseEveAgentReturn,
} from "eve/react";
import {
	CheckIcon,
	CircleCheckIcon,
	CopyIcon,
	ExternalLinkIcon,
	GlobeIcon,
	LoaderCircleIcon,
	MonitorIcon,
	TerminalIcon,
	ThumbsDownIcon,
	ThumbsUpIcon,
	WrenchIcon,
} from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { Screenshot } from "@/components/chat/screenshot";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block";
import {
	Message,
	MessageContent,
	MessageFooter,
} from "@/components/ui/message";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceIcon,
	TraceLine,
	TraceTitle,
} from "@/components/ui/trace";

type Answers = Parameters<UseEveAgentReturn["respond"]>[0];

const textOf = (m: EveMessage) =>
	m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("");

export function UserMessage({ message }: { message: EveMessage }) {
	return (
		<Message align="end">
			<MessageContent>
				<Bubble align="end" variant="muted">
					<BubbleContent>{textOf(message)}</BubbleContent>
				</Bubble>
			</MessageContent>
		</Message>
	);
}

// Parts render in order, so reasoning, tool calls and text interleave as the
// agent produced them.
export function AssistantMessage({
	message,
	streaming,
	onAnswer,
}: {
	message: EveMessage;
	streaming: boolean;
	onAnswer: (answers: Answers) => void;
}) {
	const groups = groupParts(message.parts);
	const reply = textOf(message);
	return (
		<Message>
			<MessageContent className="gap-3">
				{groups.map((g, i) =>
					g.kind === "text" ? (
						<Streamdown
							// biome-ignore lint/suspicious/noArrayIndexKey: groups are positional
							key={i}
							className="min-w-0 text-sm leading-relaxed"
							isAnimating={streaming}
						>
							{g.text}
						</Streamdown>
					) : (
						// biome-ignore lint/suspicious/noArrayIndexKey: groups are positional
						<Trace key={i}>
							{g.parts.map((p, j) =>
								p.type === "reasoning" ? (
									<ReasoningRow
										key={p.id ?? j}
										text={p.text}
										running={p.state === "streaming"}
									/>
								) : p.type === "tool" ? (
									<ToolRow key={p.callId} part={p} onAnswer={onAnswer} />
								) : p.type === "interaction" ? (
									<Prompt
										key={p.interactionId}
										interaction={p}
										onAnswer={onAnswer}
									/>
								) : null,
							)}
						</Trace>
					),
				)}
				{!streaming && reply && (
					<MessageFooter>
						<Actions text={reply} />
					</MessageFooter>
				)}
			</MessageContent>
		</Message>
	);
}

type Group =
	| { kind: "text"; text: string }
	| { kind: "steps"; parts: EveMessagePart[] };

function groupParts(parts: readonly EveMessagePart[]): Group[] {
	const out: Group[] = [];
	for (const p of parts) {
		if (p.type === "tool" && p.hidden) continue;
		const prev = out.at(-1);
		if (p.type === "text") {
			if (prev?.kind === "text") prev.text += p.text;
			else out.push({ kind: "text", text: p.text });
		} else if (p.type !== "file") {
			if (prev?.kind === "steps") prev.parts.push(p);
			else out.push({ kind: "steps", parts: [p] });
		}
	}
	return out;
}

function ReasoningRow({ text, running }: { text: string; running: boolean }) {
	const [open, setOpen] = useState<boolean>();
	return (
		<TraceCollapsible open={open ?? running} onOpenChange={setOpen}>
			<TraceCollapsibleTrigger>
				<TraceLine status={running ? "running" : undefined}>
					<TraceIcon>
						{running ? (
							<LoaderCircleIcon className="animate-spin" />
						) : (
							<CircleCheckIcon />
						)}
					</TraceIcon>
					<TraceTitle>{running ? "Thinking" : "Thought"}</TraceTitle>
				</TraceLine>
			</TraceCollapsibleTrigger>
			<TraceCollapsibleContent className="whitespace-pre-wrap">
				{text}
			</TraceCollapsibleContent>
		</TraceCollapsible>
	);
}

const RUNNING = new Set([
	"streaming",
	"requested",
	"approval",
	"running",
	"blocked",
]);

type SearchOutput = {
	results?: { url: string; title: string; snippet: string }[];
};
type DesktopOutput = {
	streamUrl?: string;
	screenshotKey?: string;
	stdout?: string;
	stderr?: string;
	exitCode?: number;
};
type ShellOutput = { stdout?: string; stderr?: string };

function ToolRow({
	part,
	onAnswer,
}: {
	part: EveToolPart;
	onAnswer: (a: Answers) => void;
}) {
	const running = RUNNING.has(part.state);
	const failed = part.state === "failed" || part.state === "rejected";
	const Icon =
		part.name === "web_search" || part.name === "web_fetch"
			? GlobeIcon
			: part.name === "computer"
				? MonitorIcon
				: part.name === "bash"
					? TerminalIcon
					: WrenchIcon;
	const asking =
		part.interaction?.status === "open" ? part.interaction : undefined;
	return (
		<TraceCollapsible defaultOpen={part.name === "computer" || !!asking}>
			<TraceCollapsibleTrigger>
				<TraceLine status={running ? "running" : failed ? "error" : undefined}>
					<TraceIcon>
						{running ? <LoaderCircleIcon className="animate-spin" /> : <Icon />}
					</TraceIcon>
					<TraceTitle>{part.label}</TraceTitle>
				</TraceLine>
			</TraceCollapsibleTrigger>
			<TraceCollapsibleContent className="flex flex-col gap-2">
				{asking && <Prompt interaction={asking} onAnswer={onAnswer} />}
				{part.error && <p className="text-destructive">{part.error.message}</p>}
				<ToolInput part={part} />
				<ToolDetail part={part} />
			</TraceCollapsibleContent>
		</TraceCollapsible>
	);
}

// What the model sent the tool. bash shows its command in the terminal instead.
function ToolInput({ part }: { part: EveToolPart }) {
	const input = part.input as Record<string, unknown> | undefined;
	if (part.name === "bash" || !input || Object.keys(input).length === 0)
		return null;
	return <Terminal text={JSON.stringify(input, null, 2)} />;
}

function ToolDetail({ part }: { part: EveToolPart }) {
	const out = part.output;
	if (out === undefined || out === null) return null;
	if (part.name === "web_search") {
		const results = (out as SearchOutput).results ?? [];
		return (
			<ul className="flex flex-col gap-1.5">
				{results.map((r) => (
					<li key={r.url} className="min-w-0">
						<a
							href={r.url}
							target="_blank"
							rel="noreferrer"
							className="font-medium text-foreground underline-offset-2 hover:underline"
						>
							{r.title || r.url}
						</a>
						<p className="truncate text-xs">{r.snippet}</p>
					</li>
				))}
			</ul>
		);
	}
	if (part.name === "computer") {
		const d = out as DesktopOutput;
		return (
			<div className="flex flex-col gap-2">
				{d.stdout !== undefined && (
					<Terminal text={[d.stdout, d.stderr].filter(Boolean).join("\n")} />
				)}
				{d.screenshotKey && <Screenshot k={d.screenshotKey} />}
				{d.streamUrl && (
					<a
						href={d.streamUrl}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
					>
						Watch the desktop live <ExternalLinkIcon className="size-3" />
					</a>
				)}
			</div>
		);
	}
	if (part.name === "bash") {
		const s = out as ShellOutput;
		const cmd = (part.input as { command?: string } | undefined)?.command;
		return (
			<Terminal
				text={`$ ${cmd ?? ""}\n${[s.stdout, s.stderr].filter(Boolean).join("\n")}`}
			/>
		);
	}
	return (
		<Terminal
			text={typeof out === "string" ? out : JSON.stringify(out, null, 2)}
		/>
	);
}

function Terminal({ text }: { text: string }) {
	return (
		<CodeBlock size="sm">
			<CodeBlockContent wrap className="max-h-64">
				{text || "(no output)"}
			</CodeBlockContent>
		</CodeBlock>
	);
}

// Approvals and questions from the agent (eve human-in-the-loop).
function Prompt({
	interaction,
	onAnswer,
}: {
	interaction: NonNullable<EveToolPart["interaction"]>;
	onAnswer: (a: Answers) => void;
}) {
	const { interactionId, request } = interaction;
	if (interaction.status !== "open") return null;
	if (request.kind === "sign-in") {
		const s = request.signIn;
		return (
			<p>
				{s?.instructions ?? request.prompt}{" "}
				{s?.url && (
					<a
						href={s.url}
						target="_blank"
						rel="noreferrer"
						className="underline"
					>
						Sign in
					</a>
				)}
			</p>
		);
	}
	return (
		<div className="flex flex-col gap-2 rounded-md border p-2">
			<p className="text-foreground">{request.prompt}</p>
			<div className="flex flex-wrap gap-2">
				{request.options?.map((o) => (
					<Button
						key={o.id}
						size="sm"
						variant="outline"
						onClick={() => onAnswer([{ interactionId, optionId: o.id }])}
					>
						{o.label}
					</Button>
				))}
			</div>
		</div>
	);
}

function Actions({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	const [vote, setVote] = useState<"up" | "down">();
	const btn = (
		label: string,
		icon: React.ReactNode,
		props: React.ComponentProps<typeof Button> = {},
	) => (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={label}
						{...props}
					/>
				}
			>
				{icon}
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
	return (
		<div className="flex items-center gap-0.5">
			{btn("Copy", copied ? <CheckIcon /> : <CopyIcon />, {
				onClick: async () => {
					await navigator.clipboard.writeText(text);
					setCopied(true);
					setTimeout(() => setCopied(false), 2000);
				},
			})}
			{btn("Good response", <ThumbsUpIcon />, {
				"aria-pressed": vote === "up",
				onClick: () => setVote(vote === "up" ? undefined : "up"),
			})}
			{btn("Bad response", <ThumbsDownIcon />, {
				"aria-pressed": vote === "down",
				onClick: () => setVote(vote === "down" ? undefined : "down"),
			})}
		</div>
	);
}
