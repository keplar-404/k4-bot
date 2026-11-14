"use client";

import {
	CheckIcon,
	CircleCheckIcon,
	CopyIcon,
	LoaderCircleIcon,
	TerminalIcon,
	ThumbsDownIcon,
	ThumbsUpIcon,
} from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
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
import { type ChatMessage, getMessageText } from "@/lib/ai";

type Part = ChatMessage["parts"][number];
type ToolPart = Extract<Part, { type: "tool-runCommand" }>;

export function UserMessage({ message }: { message: ChatMessage }) {
	return (
		<Message align="end">
			<MessageContent>
				<Bubble align="end" variant="muted">
					<BubbleContent>{getMessageText(message)}</BubbleContent>
				</Bubble>
			</MessageContent>
		</Message>
	);
}

export function AssistantMessage({
	message,
	streaming,
}: {
	message: ChatMessage;
	streaming: boolean;
}) {
	const steps = message.parts.filter(
		(p) => p.type === "reasoning" || p.type === "tool-runCommand",
	);
	const reply = getMessageText(message);
	return (
		<Message>
			<MessageContent className="gap-3">
				{steps.length > 0 && (
					<Trace>
						{steps.map((part, i) =>
							part.type === "reasoning" ? (
								<ReasoningRow
									// biome-ignore lint/suspicious/noArrayIndexKey: parts have no ids
									key={i}
									text={part.text}
									running={part.state === "streaming"}
								/>
							) : (
								part.type === "tool-runCommand" && (
									// biome-ignore lint/suspicious/noArrayIndexKey: parts have no ids
									<ToolRow key={i} part={part} streaming={streaming} />
								)
							),
						)}
					</Trace>
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

function ToolRow({ part, streaming }: { part: ToolPart; streaming: boolean }) {
	const command = part.input?.command;
	if (part.state === "output-available" || part.state === "output-error") {
		const failed = part.state === "output-error";
		return (
			<TraceCollapsible>
				<TraceCollapsibleTrigger>
					<TraceLine status={failed ? "error" : undefined}>
						<TraceIcon>
							<TerminalIcon />
						</TraceIcon>
						<TraceTitle>
							{failed ? "Failed to run" : "Ran"} {command}
						</TraceTitle>
					</TraceLine>
				</TraceCollapsibleTrigger>
				<TraceCollapsibleContent>
					<CodeBlock size="sm">
						<CodeBlockContent wrap className="max-h-64">
							{failed ? part.errorText : part.output.stdout}
						</CodeBlockContent>
					</CodeBlock>
				</TraceCollapsibleContent>
			</TraceCollapsible>
		);
	}
	return (
		<TraceLine status={streaming ? "running" : "error"}>
			<TraceIcon>
				<TerminalIcon />
			</TraceIcon>
			<TraceTitle>
				{streaming ? "Running" : "Failed to run"} {command}
			</TraceTitle>
		</TraceLine>
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
