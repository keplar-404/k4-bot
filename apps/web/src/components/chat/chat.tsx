"use client";

import { useChat } from "@ai-sdk/react";
import { createChat } from "@shadcn/helpers/ai-sdk";
import {
	ArrowUpIcon,
	GlobeIcon,
	LoaderCircleIcon,
	MessageCircleDashedIcon,
	PaperclipIcon,
	PlusIcon,
	SquareIcon,
	SquarePenIcon,
	TelescopeIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { AssistantMessage, UserMessage } from "@/components/chat/messages";
import {
	defaultEffort,
	defaultMode,
	defaultModel,
	ModelPicker,
	ModePicker,
} from "@/components/chat/pickers";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { type ChatMessage, getMessageText } from "@/lib/ai";

const FIRST = "Add a loading skeleton to the dashboard overview.";
const SECOND = "Run the type check.";
const SUGGESTIONS = [FIRST, SECOND, "What can you do?"];

// Frontend-only showcase: a scripted conversation streamed through the real
// useChat lifecycle. Swap `transport` for a real one when a backend exists.
const script = createChat<ChatMessage>()
	.user(FIRST)
	.assistant(({ writer }) => {
		writer.reasoning(
			"The overview page renders three placeholder cards. I should find where they live before adding skeletons.",
		);
		writer.sleep(300);
		writer
			.tool("runCommand", { input: { command: "rg -l Overview src/app" } })
			.sleep(700)
			.output({ stdout: "src/app/dashboard/page.tsx" });
		writer.sleep(300);
		writer.text(`The cards are in \`src/app/dashboard/page.tsx\`. I wrapped them in a \`Suspense\` boundary with a **Skeleton** fallback.

**Changes**

- Added a \`loading.tsx\` next to the page.
- Reused the \`Skeleton\` component, so no custom styles.

\`\`\`tsx
export default function Loading() {
  return <Skeleton className="aspect-video rounded-xl" />
}
\`\`\`
`);
	})
	.user(SECOND)
	.assistant(({ writer }) => {
		writer
			.tool("runCommand", { input: { command: "bunx tsc --noEmit" } })
			.sleep(1200)
			.output({ stdout: "Found 0 errors." });
		writer.sleep(300);
		writer.text(
			"The type check passes with **0 errors**, so it is safe to ship.",
		);
	});

const initialMessages = script.get(2);
const transport = script.transport({
	delayMs: 14,
	fallback: ({ writer, messages }) => {
		const last = messages.findLast((m) => m.role === "user");
		const quote = (last ? getMessageText(last) : "")
			.split("\n")
			.map((l) => `> ${l}`)
			.join("\n");
		writer.reasoning(
			"This is a frontend-only showcase, so no model is connected. I'll say what is missing.",
		);
		writer.sleep(300);
		writer.text(`${quote}

I only know the scripted turns. Connect a backend route that streams **AI SDK UI messages** and swap the \`transport\` in \`chat.tsx\` to get real replies.`);
	},
});

export function Chat() {
	const { messages, sendMessage, setMessages, status, stop } =
		useChat<ChatMessage>({ messages: initialMessages, transport });
	const [input, setInput] = useState("");
	const [model, setModel] = useState(defaultModel);
	const [effort, setEffort] = useState(defaultEffort);
	const [mode, setMode] = useState(defaultMode);
	const formRef = useRef<HTMLFormElement>(null);
	const busy = status === "submitted" || status === "streaming";

	function send(text: string) {
		const t = text.trim();
		if (!t || busy) return;
		void sendMessage({ text: t });
		setInput("");
	}

	return (
		<MessageScrollerProvider autoScroll>
			<div className="mx-auto flex h-[calc(100dvh-4rem)] min-h-0 w-full max-w-4xl flex-col gap-2 px-3 pb-3 sm:px-6 sm:pb-4">
				<div className="flex items-center justify-between gap-2">
					<div className="min-w-0">
						<div className="truncate font-medium">AI Assistant</div>
						<div className="truncate text-xs text-muted-foreground">
							Frontend demo, scripted replies
						</div>
					</div>
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									variant="outline"
									size="icon"
									aria-label="New chat"
									disabled={busy}
									onClick={() => setMessages([])}
								/>
							}
						>
							<SquarePenIcon />
						</TooltipTrigger>
						<TooltipContent>New chat</TooltipContent>
					</Tooltip>
				</div>

				<div className="min-h-0 flex-1">
					{messages.length === 0 ? (
						<Empty className="h-full">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<MessageCircleDashedIcon />
								</EmptyMedia>
								<EmptyTitle>What should we build?</EmptyTitle>
								<EmptyDescription>
									Pick a suggestion below or type your own message.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						<MessageScroller>
							<MessageScrollerViewport className="scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
								<MessageScrollerContent aria-busy={busy} className="gap-6">
									{messages.map((m) => (
										<MessageScrollerItem
											key={m.id}
											messageId={m.id}
											scrollAnchor={m.role === "user"}
										>
											{m.role === "user" ? (
												<UserMessage message={m} />
											) : (
												<AssistantMessage
													message={m}
													streaming={busy && m === messages.at(-1)}
												/>
											)}
										</MessageScrollerItem>
									))}
									{status === "submitted" && (
										<Marker role="status">
											<MarkerIcon>
												<LoaderCircleIcon className="animate-spin" />
											</MarkerIcon>
											<MarkerContent className="shimmer">
												Thinking…
											</MarkerContent>
										</Marker>
									)}
								</MessageScrollerContent>
							</MessageScrollerViewport>
							<MessageScrollerButton />
						</MessageScroller>
					)}
				</div>

				{!busy && (
					<div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
						{SUGGESTIONS.map((s) => (
							<Button
								key={s}
								variant="outline"
								size="sm"
								className="shrink-0"
								onClick={() => send(s)}
							>
								{s}
							</Button>
						))}
					</div>
				)}

				<form
					ref={formRef}
					onSubmit={(e) => {
						e.preventDefault();
						send(input);
					}}
				>
					<InputGroup>
						<InputGroupTextarea
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder="Ask the assistant…"
							aria-label="Message"
							className="max-h-40 min-h-14 text-base md:text-sm"
							onKeyDown={(e) => {
								if (
									e.key === "Enter" &&
									!e.shiftKey &&
									!e.nativeEvent.isComposing
								) {
									e.preventDefault();
									formRef.current?.requestSubmit();
								}
							}}
						/>
						<InputGroupAddon align="block-end" className="pt-1">
							<DropdownMenu>
								<DropdownMenuTrigger
									render={
										<InputGroupButton
											type="button"
											size="icon-sm"
											variant="outline"
											aria-label="Add context"
										/>
									}
								>
									<PlusIcon />
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start" side="top" className="w-44">
									<DropdownMenuItem>
										<PaperclipIcon />
										Add Photos & Files
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem>
										<TelescopeIcon />
										Deep Research
									</DropdownMenuItem>
									<DropdownMenuItem>
										<GlobeIcon />
										Web Search
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
							<ModelPicker
								model={model}
								effort={effort}
								onModel={setModel}
								onEffort={setEffort}
							/>
							<ModePicker value={mode} onChange={setMode} />
							{busy ? (
								<InputGroupButton
									type="button"
									size="icon-sm"
									variant="default"
									className="ml-auto"
									onClick={() => void stop()}
								>
									<SquareIcon />
									<span className="sr-only">Stop</span>
								</InputGroupButton>
							) : (
								<InputGroupButton
									type="submit"
									size="icon-sm"
									variant="default"
									className="ml-auto"
									disabled={!input.trim()}
								>
									<ArrowUpIcon />
									<span className="sr-only">Send</span>
								</InputGroupButton>
							)}
						</InputGroupAddon>
					</InputGroup>
				</form>
			</div>
		</MessageScrollerProvider>
	);
}
