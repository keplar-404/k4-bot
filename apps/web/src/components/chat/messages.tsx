"use client";

import type { SearchOutput } from "@repo/shared/tools";
import type { EveMessage, EveToolPart } from "eve/react";
import {
	BrainIcon,
	CheckIcon,
	CopyIcon,
	DownloadIcon,
	FileIcon,
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
import { speak, stopSpeaking } from "@/components/chat/voice";
import {
	Attachment,
	AttachmentAction,
	AttachmentActions,
	AttachmentContent,
	AttachmentDescription,
	AttachmentGroup,
	AttachmentMedia,
	AttachmentTitle,
} from "@/components/ui/attachment";
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
import { api } from "@/lib/api";
import { useManualOpen } from "@/lib/chat-ui";
import { type StartOrder, type Step, splitTurn } from "./split-turn";

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
					<AttachmentGroup>
						{files.map((f) => (
							<FileCard key={f.key} file={f} />
						))}
					</AttachmentGroup>
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

// A file the agent shared or made (share_file, media): a fresh 5-minute link per click.
function FileCard({
	file,
}: {
	file: { key: string; name: string; size: number; type?: string };
}) {
	const [state, setState] = useState<"done" | "processing" | "error">("done");
	const link = () =>
		api.api.files
			.$get({ query: { key: file.key } })
			.then(async (r) => (r.ok ? (await r.json()).url : null))
			.catch(() => null);
	// Images, audio and video show a preview or player (a 5-minute link, fetched when
	// the card appears). ponytail: a long video seeked after 5 minutes needs a reload.
	const kind = file.type?.split("/")[0];
	const image = kind === "image";
	const tall = image || kind === "video";
	const [preview, setPreview] = useState<string | null>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: once per file
	useEffect(() => {
		if (image || kind === "audio" || kind === "video")
			void link().then(setPreview);
	}, [file.key]);
	async function download() {
		setState("processing");
		const url = await link();
		if (!url) return setState("error");
		window.location.assign(url);
		setState("done");
	}
	return (
		<Attachment state={state} orientation={tall ? "vertical" : "horizontal"}>
			<AttachmentMedia variant={preview && image ? "image" : "icon"}>
				{preview && image ? (
					// biome-ignore lint/performance/noImgElement: a signed R2 link, not a static asset
					<img src={preview} alt={file.name} />
				) : preview && kind === "video" ? (
					// biome-ignore lint/a11y/useMediaCaption: generated video, no captions exist
					<video
						src={preview}
						controls
						preload="metadata"
						className="size-full object-contain"
					/>
				) : (
					<FileIcon />
				)}
			</AttachmentMedia>
			<AttachmentContent>
				<AttachmentTitle>{file.name}</AttachmentTitle>
				<AttachmentDescription>
					{state === "error" ? "Download failed" : bytes.format(file.size)}
				</AttachmentDescription>
				{preview && kind === "audio" && (
					// biome-ignore lint/a11y/useMediaCaption: generated audio, no captions exist
					<audio
						src={preview}
						controls
						preload="metadata"
						className="mt-1.5 h-8 w-full min-w-48"
					/>
				)}
			</AttachmentContent>
			<AttachmentActions>
				<AttachmentAction
					aria-label={`Download ${file.name}`}
					onClick={download}
				>
					<DownloadIcon />
				</AttachmentAction>
			</AttachmentActions>
		</Attachment>
	);
}
const bytes = new Intl.NumberFormat("en", {
	notation: "compact",
	style: "unit",
	unit: "byte",
	unitDisplay: "narrow",
});

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
