"use client";

import type { DesktopOutput, SearchOutput } from "@repo/shared/tools";
import type {
	EveMessage,
	EveMessagePart,
	EveToolPart,
	UseEveAgentReturn,
} from "eve/react";
import {
	BrainIcon,
	CheckIcon,
	CopyIcon,
	ExternalLinkIcon,
	GlobeIcon,
	LoaderCircleIcon,
	MonitorIcon,
	SparklesIcon,
	TerminalIcon,
	ThumbsDownIcon,
	ThumbsUpIcon,
	WrenchIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
	TraceDescription,
	TraceIcon,
	TraceLine,
	TraceTitle,
} from "@/components/ui/trace";
import { useManualOpen } from "@/lib/chat-ui";

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

// A turn reads as one unit: a "Steps" block (thinking, tools, narration) that is
// open and shimmering while the agent works and folds to a one-line summary when
// it is done, followed by the final reply. Nothing here keeps its own copy of
// the conversation: eve's useEveAgent store owns it and these components only
// project `message.parts`, so there is no second store to fall out of sync.
export function AssistantMessage({
	message,
	streaming,
	onAnswer,
}: {
	message: EveMessage;
	streaming: boolean;
	onAnswer: (answers: Answers) => void;
}) {
	const { steps, reply } = splitTurn(message.parts);
	const running = streaming || steps.some(isRunning);
	return (
		<Message>
			<MessageContent className="gap-3">
				{(running || steps.length > 0) && (
					<Steps
						id={message.id}
						steps={steps}
						running={running}
						onAnswer={onAnswer}
					/>
				)}
				{reply && (
					<Streamdown
						className="min-w-0 text-sm leading-relaxed"
						isAnimating={streaming}
					>
						{reply}
					</Streamdown>
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

// Shown the instant a message is sent, before eve has projected any assistant
// part, so there is never a blank gap between "send" and the first event.
export function PendingAssistant() {
	return (
		<Message>
			<MessageContent>
				<Steps id="pending" steps={[]} running onAnswer={() => {}} />
			</MessageContent>
		</Message>
	);
}

type Step = Exclude<EveMessagePart, { type: "file" }>;

// Everything up to the last non-text part is "steps" (text in there is the
// agent narrating between calls). The text after it is the final reply.
function splitTurn(parts: readonly EveMessagePart[]) {
	const visible = parts.filter(
		(p): p is Step => p.type !== "file" && !(p.type === "tool" && p.hidden),
	);
	const last = visible.findLastIndex((p) => p.type !== "text");
	return {
		steps: visible.slice(0, last + 1),
		reply: visible
			.slice(last + 1)
			.flatMap((p) => (p.type === "text" ? [p.text] : []))
			.join(""),
	};
}

const RUNNING = new Set([
	"streaming",
	"requested",
	"approval",
	"running",
	"blocked",
]);

const isRunning = (p: Step) =>
	p.type === "reasoning"
		? p.state === "streaming"
		: p.type === "tool"
			? RUNNING.has(p.state)
			: false;

function useElapsed(running: boolean) {
	const start = useRef<number>(undefined);
	const [secs, setSecs] = useState(0);
	useEffect(() => {
		if (!running) return;
		start.current ??= Date.now();
		const id = setInterval(
			() => setSecs(Math.round((Date.now() - (start.current ?? 0)) / 1000)),
			1000,
		);
		return () => clearInterval(id);
	}, [running]);
	return secs;
}

function AgentLogo({ running }: { running: boolean }) {
	return (
		<span
			aria-hidden="true"
			className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
		>
			<SparklesIcon className={running ? "size-3 animate-pulse" : "size-3"} />
		</span>
	);
}

function Steps({
	id,
	steps,
	running,
	onAnswer,
}: {
	id: string;
	steps: Step[];
	running: boolean;
	onAnswer: (a: Answers) => void;
}) {
	// Open while the agent works, folded when it finishes. Once the person
	// toggles it, their choice wins.
	const [manual, setManual] = useManualOpen(`steps:${id}`);
	const waiting = steps.some(
		(p) =>
			(p.type === "tool" && p.interaction?.status === "open") ||
			(p.type === "interaction" && p.status === "open"),
	);
	const open = manual ?? (running || waiting);
	const secs = useElapsed(running);
	const count = steps.filter((p) => p.type !== "text").length;
	return (
		<Trace>
			<TraceCollapsible open={open} onOpenChange={setManual}>
				<TraceCollapsibleTrigger>
					<AgentLogo running={running} />
					<TraceLine status={running ? "running" : undefined}>
						<TraceTitle>{running ? "Deep diving" : "Steps"}</TraceTitle>
						{!running && count > 0 && (
							<TraceDescription>
								{count}
								{secs >= 1 ? ` · ${secs}s` : ""}
							</TraceDescription>
						)}
					</TraceLine>
				</TraceCollapsibleTrigger>
				{/* One polite status for screen readers instead of every shimmer tick. */}
				<span role="status" className="sr-only">
					{running ? "Working" : ""}
				</span>
				<TraceCollapsibleContent className="flex flex-col gap-2.5">
					{steps.map((p, i) =>
						p.type === "reasoning" ? (
							<ReasoningRow
								key={p.id ?? `r${i}`}
								k={`${id}:r:${p.id ?? i}`}
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
						) : (
							<p key={p.id ?? `t${i}`} className="text-sm whitespace-pre-wrap">
								{p.text}
							</p>
						),
					)}
					{running && steps.length === 0 && (
						<span className="text-xs text-muted-foreground">
							Getting started…
						</span>
					)}
				</TraceCollapsibleContent>
			</TraceCollapsible>
		</Trace>
	);
}

function ReasoningRow({
	k,
	text,
	running,
}: {
	k: string;
	text: string;
	running: boolean;
}) {
	const [open, setOpen] = useManualOpen(k);
	return (
		<TraceCollapsible open={open ?? running} onOpenChange={setOpen}>
			<TraceCollapsibleTrigger>
				<TraceLine status={running ? "running" : undefined}>
					<TraceIcon>
						<BrainIcon className={running ? "animate-pulse" : undefined} />
					</TraceIcon>
					<TraceTitle>{running ? "Thinking" : "Thought"}</TraceTitle>
				</TraceLine>
			</TraceCollapsibleTrigger>
			<TraceCollapsibleContent>
				<FadeScroll follow={running}>{text}</FadeScroll>
			</TraceCollapsibleContent>
		</TraceCollapsible>
	);
}

// A capped box that fades out at the bottom while there is more below, and
// follows new text while `follow` is on unless the person scrolled up.
function FadeScroll({
	children,
	follow,
}: {
	children: React.ReactNode;
	follow: boolean;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const pinned = useRef(true);
	// Plain DOM attribute, not state: measuring must never re-render.
	const measure = () => {
		const el = ref.current;
		if (!el) return;
		const left = el.scrollHeight - el.scrollTop - el.clientHeight;
		pinned.current = left < 24;
		el.dataset.more = String(left > 4);
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the text grows
	useEffect(() => {
		const el = ref.current;
		if (el && follow && pinned.current) el.scrollTop = el.scrollHeight;
		measure();
	}, [children, follow]);
	return (
		<div
			ref={ref}
			onScroll={measure}
			data-more="false"
			className="max-h-48 overflow-y-auto whitespace-pre-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden data-[more=true]:[mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)]"
		>
			{children}
		</div>
	);
}

type ShellOutput = { stdout?: string; stderr?: string };

// The one-line gist next to a tool's title: the query, command or action.
function gist(part: EveToolPart) {
	const i = (part.input ?? {}) as Record<string, unknown>;
	const v = i.query ?? i.command ?? i.action ?? i.url;
	return typeof v === "string" ? v : undefined;
}

function ToolRow({
	part,
	onAnswer,
}: {
	part: EveToolPart;
	onAnswer: (a: Answers) => void;
}) {
	const [manual, setManual] = useManualOpen(`t:${part.callId}`);
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
	const g = gist(part);
	return (
		<TraceCollapsible
			open={manual ?? (running || !!asking)}
			onOpenChange={setManual}
		>
			<TraceCollapsibleTrigger>
				<TraceLine status={running ? "running" : failed ? "error" : undefined}>
					<TraceIcon>
						{running ? <LoaderCircleIcon className="animate-spin" /> : <Icon />}
					</TraceIcon>
					<TraceTitle>{part.label}</TraceTitle>
					{g && <TraceDescription className="truncate">{g}</TraceDescription>}
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
	if (part.state === "streaming" && part.inputText)
		return <Terminal text={part.inputText} />;
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
