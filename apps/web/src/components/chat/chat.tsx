"use client";

import { defaultModelId, type Effort } from "@repo/shared/models";
import { activeTurn } from "eve/events";
import { useEveAgent } from "eve/react";
import {
	ArrowUpIcon,
	MessageCircleDashedIcon,
	SquareIcon,
	SquarePenIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { MessagesSkeleton } from "@/components/chat/chat-skeleton";
import {
	AssistantMessage,
	PendingAssistant,
	UserMessage,
} from "@/components/chat/messages";
import {
	defaultMode,
	ModelPicker,
	ModePicker,
} from "@/components/chat/pickers";
import { startOrder } from "@/components/chat/split-turn";
import { Button } from "@/components/ui/button";
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
import { api, notifyChatsChanged } from "@/lib/api";
import { getToken } from "@/lib/auth-client";

const SUGGESTIONS = [
	"Search the web for this week's top AI news.",
	"Open Firefox on the desktop and go to news.ycombinator.com.",
	"What can you do?",
];

// Talks to the eve agent in apps/ai-agent through /eve/v1/* (see next.config.ts).
// The agent checks the Better Auth session cookie against apps/backend.
// Saved chats follow eve's Next.js guide: create the chat record before the
// first message, save the session id from onSessionChange, reopen with
// initialSession + resume, and switch the URL with History.replaceState.
// The chat only reopens if its session id is saved, so retry a few times.
// Change the address bar only. The native method, because Next patches
// window.history.replaceState to sync its router, and this must not navigate.
const setUrl = (path: string) =>
	History.prototype.replaceState.call(
		window.history,
		window.history.state,
		"",
		path,
	);

async function saveSession(id: string, eveSessionId: string) {
	for (let i = 0; i < 3; i++) {
		try {
			const res = await api.api.chats[":id"].$patch({
				param: { id },
				json: { eveSessionId },
			});
			if (res.ok) return true;
		} catch {}
		await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
	}
	return false;
}

export function Chat({
	chatId: savedChatId,
	sessionId,
}: {
	chatId?: string;
	sessionId?: string | null;
}) {
	const chatIdRef = useRef(savedChatId);
	const savedSessionRef = useRef(sessionId ?? undefined);
	const agent = useEveAgent({
		// The agent checks this token on every request; it is re-read each time.
		auth: { bearer: async () => (await getToken()) ?? "" },
		...(sessionId
			? { initialSession: { sessionId, streamIndex: 0 }, resume: true }
			: {}),
		onSessionChange: (session) => {
			const id = chatIdRef.current;
			const sid = session?.sessionId;
			if (!id || !sid || sid === savedSessionRef.current) return;
			savedSessionRef.current = sid;
			void saveSession(id, sid).then((ok) => {
				if (ok) return;
				savedSessionRef.current = undefined; // let the next change try again
				toast.error(
					"Could not save this chat. It may be missing from history.",
				);
			});
		},
	});
	const [input, setInput] = useState("");
	const [model, setModel] = useState(defaultModelId);
	const [effort, setEffort] = useState<Effort>();
	const [mode, setMode] = useState(defaultMode);
	const formRef = useRef<HTMLFormElement>(null);

	const resuming = agent.status === "resuming";
	// Real start order of every part, so parallel steps render as produced.
	const order = startOrder(agent.events);
	const running = activeTurn(agent.view) !== undefined;
	const busy = agent.status === "busy" || running;

	async function send(text: string) {
		const t = text.trim();
		if (!t || resuming) return;
		setInput("");
		if (!chatIdRef.current) {
			const res = await api.api.chats.$post({
				json: { title: t.slice(0, 80) },
			});
			if (!res.ok) return setInput(t);
			const { id } = await res.json();
			chatIdRef.current = id;
			setUrl(`/dashboard/chat/${encodeURIComponent(id)}`);
			notifyChatsChanged();
		}
		// Sent while running, the message steers the current turn.
		await agent.send(t, {
			clientContext: { model, reasoning: effort ?? null, mode },
		});
	}

	function newChat() {
		agent.newSession();
		chatIdRef.current = undefined;
		savedSessionRef.current = undefined;
		setUrl("/dashboard/chat");
	}

	return (
		<MessageScrollerProvider autoScroll>
			<div className="flex h-[calc(100dvh-4rem)] min-h-0 w-full flex-col gap-2 px-3 pb-3 *:mx-auto *:w-full *:max-w-4xl sm:px-6 sm:pb-4">
				<div className="flex items-center justify-between gap-2">
					<div className="min-w-0">
						<div className="truncate font-medium">AI Assistant</div>
						<div className="truncate text-xs text-muted-foreground">
							Web search, Linux desktop and a sandbox shell
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
									onClick={newChat}
								/>
							}
						>
							<SquarePenIcon />
						</TooltipTrigger>
						<TooltipContent>New chat</TooltipContent>
					</Tooltip>
				</div>

				{/* full width so the empty side space scrolls the chat too */}
				<div className="min-h-0 flex-1 max-w-none!">
					{resuming && agent.messages.length === 0 ? (
						<MessagesSkeleton />
					) : agent.messages.length === 0 ? (
						<Empty className="h-full">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<MessageCircleDashedIcon />
								</EmptyMedia>
								<EmptyTitle>What should we do?</EmptyTitle>
								<EmptyDescription>
									Pick a suggestion below or type your own message.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						<MessageScroller>
							<MessageScrollerViewport className="scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
								<MessageScrollerContent
									aria-busy={busy}
									className="mx-auto max-w-4xl gap-6"
								>
									{agent.messages.map((m) => (
										<MessageScrollerItem key={m.id} messageId={m.id}>
											{m.role === "user" ? (
												<UserMessage message={m} />
											) : (
												<AssistantMessage
													message={m}
													streaming={m.metadata?.status === "streaming"}
													order={order}
													onAnswer={(answers) => void agent.respond(answers)}
												/>
											)}
										</MessageScrollerItem>
									))}
									{busy && agent.messages.at(-1)?.role === "user" && (
										<MessageScrollerItem messageId="pending">
											<PendingAssistant />
										</MessageScrollerItem>
									)}
								</MessageScrollerContent>
							</MessageScrollerViewport>
							<MessageScrollerButton />
						</MessageScroller>
					)}
				</div>

				{!busy && !resuming && agent.messages.length === 0 && (
					<div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
						{SUGGESTIONS.map((s) => (
							<Button
								key={s}
								variant="outline"
								size="sm"
								className="shrink-0"
								onClick={() => void send(s)}
							>
								{s}
							</Button>
						))}
					</div>
				)}

				{/* Next to the input, under the turn that failed, so it reads as that turn's result. */}
				{agent.error && !busy && (
					<p role="alert" className="text-sm text-destructive">
						{agent.error.message}
					</p>
				)}

				<form
					ref={formRef}
					onSubmit={(e) => {
						e.preventDefault();
						void send(input);
					}}
				>
					<InputGroup>
						<InputGroupTextarea
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder={
								running ? "Steer the assistant…" : "Ask the assistant…"
							}
							aria-label="Message"
							disabled={resuming}
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
							<ModelPicker
								model={model}
								effort={effort}
								onModel={(m) => {
									setModel(m);
									setEffort(undefined); // fall back to the new model's default
								}}
								onEffort={setEffort}
							/>
							<ModePicker value={mode} onChange={setMode} />
							{running && !input.trim() ? (
								<InputGroupButton
									type="button"
									size="icon-sm"
									variant="default"
									className="ml-auto"
									onClick={() => void agent.cancel()}
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
									disabled={!input.trim() || resuming}
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
