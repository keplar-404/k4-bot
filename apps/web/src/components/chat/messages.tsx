"use client";

import { typeOf } from "@repo/shared/files";
import type { SearchOutput } from "@repo/shared/tools";
import type { EveMessage, EveToolPart } from "eve/react";
import {
	BrainIcon,
	CheckIcon,
	CopyIcon,
	GlobeIcon,
	LoaderCircleIcon,
	MessageSquareTextIcon,
	SparklesIcon,
	ThumbsDownIcon,
	ThumbsUpIcon,
	Volume2Icon,
	WrenchIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { FileCard } from "@/components/chat/file-card";
import { speak, stopSpeaking } from "@/components/chat/voice";
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
import { type StartOrder, type Step, splitTurn } from "./split-turn";

const textOf = (m: EveMessage) =>
	m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("");

// chat.tsx sends an upload's id inside the text for the agent; the user sees a card.
// Until the server echoes the message, eve shows it as text with "[file: name]" after.
const ATTACHED = /\n\n\(Attached .+, file id `([^`]+)`\.\)[\s\S]*$/;

export function UserMessage({ message }: { message: EveMessage }) {
	const text = textOf(message);
	const key = ATTACHED.exec(text)?.[1];
	const part = message.parts.find((p) => p.type === "file");
	const name =
		part?.filename ?? decodeURIComponent(key?.split("/").pop() ?? "");
	const files = key
		? [{ key, name, size: part?.size, type: part?.mediaType ?? typeOf(name) }]
		: [];
	return (
		<Message align="end">
			<MessageContent className="items-end gap-2">
				{files.length > 0 && (
					<div className="flex flex-wrap justify-end gap-2">
						{files.map((f) => (
							<FileCard key={f.key} file={f} compact />
						))}
					</div>
				)}
				<Bubble align="end" variant="muted">
					<BubbleContent>{text.replace(ATTACHED, "")}</BubbleContent>
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
	order,
}: {
	message: EveMessage;
	streaming: boolean;
	order?: StartOrder;
}) {
	const { steps, reply } = splitTurn(message.parts, order);
	const running = streaming || steps.some(isRunning);
	// Files the agent gave the user (share_file) show under the reply, not in folded Steps.
	const files = message.parts.flatMap((p) => {
		const f = (
			p.type === "tool" && p.name === "share_file" ? p.output : undefined
		) as
			| { key?: unknown; name?: unknown; size?: unknown; type?: unknown }
			| undefined;
		return typeof f?.key === "string" &&
			typeof f.name === "string" &&
			typeof f.size === "number"
			? [
					{
						key: f.key,
						name: f.name,
						size: f.size,
						type: typeof f.type === "string" ? f.type : undefined,
					},
				]
			: [];
	});
	return (
		<Message>
			<MessageContent className="gap-3">
				{(running || steps.length > 0) && (
					<Steps id={message.id} steps={steps} running={running} />
				)}
				{reply && (
					<Streamdown
						className="min-w-0 text-sm leading-relaxed"
						isAnimating={streaming}
					>
						{reply}
					</Streamdown>
				)}
				{files.length > 0 && (
					<div className="grid gap-2 sm:grid-cols-2">
						{files.map((f) => (
							<FileCard key={f.key} file={f} />
						))}
					</div>
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
				<Steps id="pending" steps={[]} running />
			</MessageContent>
		</Message>
	);
}

export const RUNNING = new Set([
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

// Seconds since the agent started, in tenths while it runs.
function useElapsed(running: boolean) {
	const start = useRef<number>(undefined);
	const [secs, setSecs] = useState(0);
	useEffect(() => {
		if (!running) return;
		start.current ??= Date.now();
		const id = setInterval(
			() => setSecs((Date.now() - (start.current ?? 0)) / 1000),
			100,
		);
		return () => clearInterval(id);
	}, [running]);
	return secs;
}
const clock = (s: number) =>
	s < 60
		? `${s.toFixed(1)}s`
		: `${Math.floor(s / 60)}m ${(s % 60).toFixed(1)}s`;

function AgentLogo() {
	return (
		<span
			aria-hidden="true"
			className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
		>
			<SparklesIcon className="size-3" />
		</span>
	);
}

// While the agent works: a 3×3 grid where a chevron of light drives left to right.
// The 650 ms cycle is shorter than the sweep, so two fronts are always moving.
const DRIVE = Array.from(
	{ length: 9 },
	(_, i) => ((i % 3) + Math.abs(Math.floor(i / 3) - 1)) * 90,
);
function WorkingLoader() {
	return (
		<span
			aria-hidden="true"
			className="grid size-5 shrink-0 grid-cols-[repeat(3,4px)] place-content-center gap-[1.5px]"
		>
			{DRIVE.map((delay, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed grid of cells
					key={i}
					className="size-1 animate-[pixel-on_650ms_ease-in-out_infinite] rounded-[1px] bg-primary opacity-15 motion-reduce:animate-none"
					style={{ animationDelay: `${delay}ms` }}
				/>
			))}
		</span>
	);
}

function Steps({
	id,
	steps,
	running,
}: {
	id: string;
	steps: Step[];
	running: boolean;
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
					{running ? <WorkingLoader /> : <AgentLogo />}
					<TraceLine status={running ? "running" : undefined}>
						<TraceTitle>{running ? "Deep diving" : "Steps"}</TraceTitle>
						{running ? (
							<TraceDescription className="font-mono text-xs">
								{clock(secs)}
							</TraceDescription>
						) : (
							count > 0 && (
								<TraceDescription>
									{count}
									{secs >= 1 ? ` · ${Math.round(secs)}s` : ""}
								</TraceDescription>
							)
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
							<ToolRow key={p.callId} part={p} />
						) : p.type === "interaction" ? null : (
							p.text.trim() && (
								<div
									key={p.id ?? `t${i}`}
									className="flex gap-2 text-xs text-muted-foreground"
								>
									<MessageSquareTextIcon className="mt-0.5 size-3.5 shrink-0" />
									<p className="min-w-0 whitespace-pre-wrap italic">
										{p.text.trim()}
									</p>
								</div>
							)
						),
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

// The one-line gist next to a tool's title: the query, command or action.
function gist(part: EveToolPart) {
	const i = (part.input ?? {}) as Record<string, unknown>;
	const v = i.query ?? i.command ?? i.text ?? i.url;
	return typeof v === "string" ? v : undefined;
}

export function ToolRow({ part }: { part: EveToolPart }) {
	const [manual, setManual] = useManualOpen(`t:${part.callId}`);
	const running = RUNNING.has(part.state);
	const failed = part.state === "failed" || part.state === "rejected";
	const Icon =
		part.name === "web_search" || part.name === "web_fetch"
			? GlobeIcon
			: WrenchIcon;
	const g = gist(part);
	return (
		<TraceCollapsible open={manual ?? false} onOpenChange={setManual}>
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
				{part.error && <p className="text-destructive">{part.error.message}</p>}
				<ToolInput part={part} />
				<ToolDetail part={part} />
			</TraceCollapsibleContent>
		</TraceCollapsible>
	);
}

// What the model sent the tool.
function ToolInput({ part }: { part: EveToolPart }) {
	if (part.state === "streaming" && part.inputText)
		return <Terminal text={part.inputText} />;
	const input = part.input as Record<string, unknown> | undefined;
	if (!input || Object.keys(input).length === 0) return null;
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
			{btn("Read aloud", <Volume2Icon />, {
				onClick: () =>
					speechSynthesis.speaking ? stopSpeaking() : speak(text),
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
