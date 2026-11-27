"use client";

// Routines plug-in: one routine's page. Counts, drafts that need the user, run history.
import { CopyIcon, PlayIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { dropCachedChat, forgetChatCheck } from "@/lib/chat-cache";
import {
	forgetRoutine,
	type RoutinePage as Page,
	refreshRoutines,
	useRoutine,
} from "./data";
import { useEditRoutine } from "./edit-panel";
import { startTestRun } from "./start-run";
import { describeTiming, type Repeat } from "./timing";

type Approval = Page["approvals"][number];
const STATUS: Record<
	string,
	{
		label: string;
		variant: "default" | "secondary" | "destructive" | "outline";
	}
> = {
	running: { label: "Running", variant: "secondary" },
	ok: { label: "Done", variant: "outline" },
	failed: { label: "Failed", variant: "destructive" },
	needs_you: { label: "Needs you", variant: "default" },
};
const when = (d: string | Date) =>
	new Date(d).toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});

export function RoutinePage({ id }: { id: string }) {
	const router = useRouter();
	const { data, error } = useRoutine(id);
	// The Edit routine tab belongs to the routine: here and in each of its run chats.
	useEditRoutine(id);
	const [review, setReview] = useState<Approval>();
	const [busy, setBusy] = useState<string>();
	const [confirmDelete, setConfirmDelete] = useState(false);

	if (error)
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>Routine not found</EmptyTitle>
				</EmptyHeader>
			</Empty>
		);
	if (!data)
		return (
			<div className="mx-auto w-full max-w-3xl space-y-4 p-6">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-24" />
				<Skeleton className="h-48" />
			</div>
		);
	const { routine: r, stats, runs, approvals } = data;

	async function runTest() {
		setBusy("test");
		try {
			const { chatId } = await startTestRun(id);
			refreshRoutines(id);
			router.push(`/dashboard/routines/${id}/runs/${chatId}`);
		} catch (e) {
			toast.error((e as Error).message);
		} finally {
			setBusy(undefined);
		}
	}
	async function decide(a: Approval, decision: "approve" | "cancel") {
		setBusy(a.id);
		const res = await api.api.routines.approvals[":id"]
			.$post({ param: { id: a.id }, json: { decision } })
			.catch(() => undefined);
		setBusy(undefined);
		setReview(undefined);
		const body = (await res?.json().catch(() => ({}))) as
			| { error?: string; result?: string }
			| undefined;
		refreshRoutines(id);
		if (!res?.ok)
			return toast.error(body?.error ?? body?.result ?? "That didn't work.");
		if (decision === "cancel") return toast("Draft cancelled");
		if (a.kind === "chat")
			return router.push(`/dashboard/routines/${id}/runs/${a.chatId}`);
		toast.success("Approved and done");
	}
	async function remove() {
		setBusy("delete");
		const res = await api.api.routines[":id"]
			.$delete({ param: { id } })
			.catch(() => undefined);
		setBusy(undefined);
		if (!res?.ok) return toast.error("Could not delete the routine.");
		const { chatIds } = (await res.json()) as { chatIds: string[] };
		// Its run chats are gone too: drop this browser's copies of them.
		for (const c of chatIds) {
			void dropCachedChat(c);
			forgetChatCheck(c);
		}
		setConfirmDelete(false);
		router.push("/dashboard/chat");
		forgetRoutine(id);
		toast("Routine deleted");
	}
	async function toggle() {
		const res = await api.api.routines[":id"].$patch({
			param: { id },
			json: { enabled: !r.enabled },
		});
		if (!res.ok) return toast.error("Could not change the routine.");
		refreshRoutines(id);
	}

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6 overflow-y-auto p-4 sm:p-6">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<h1 className="truncate text-xl font-semibold">{r.name}</h1>
					<p className="text-sm text-muted-foreground">
						{describeTiming({ startAt: r.startAt, repeat: r.repeat as Repeat })}{" "}
						· {r.timezone}
						{r.enabled
							? r.nextRunAt
								? ` · next ${when(r.nextRunAt)}`
								: " · no more runs"
							: " · paused"}
					</p>
					<button
						type="button"
						className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
						onClick={() =>
							navigator.clipboard
								.writeText(r.id)
								.then(() => toast("Routine ID copied"))
						}
					>
						{r.id} <CopyIcon className="size-3" aria-label="Copy routine ID" />
					</button>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" onClick={toggle}>
						{r.enabled ? "Pause" : "Resume"}
					</Button>
					<Button onClick={runTest} disabled={busy === "test"}>
						<PlayIcon /> {busy === "test" ? "Starting…" : "Run test"}
					</Button>
					<Button
						variant="outline"
						size="icon"
						aria-label="Delete routine"
						title="Delete routine"
						className="hover:text-destructive"
						onClick={() => setConfirmDelete(true)}
					>
						<Trash2Icon />
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-3 gap-3">
				{[
					["Runs", stats.runs],
					["Succeeded", stats.ok],
					["Failed", stats.failed],
				].map(([label, n]) => (
					<Card key={label} size="sm">
						<CardHeader>
							<CardDescription>{label}</CardDescription>
							<CardTitle className="text-2xl tabular-nums">{n}</CardTitle>
						</CardHeader>
					</Card>
				))}
			</div>

			<section className="flex flex-col gap-2">
				<h2 className="text-sm font-medium">
					Need your attention{" "}
					{approvals.length > 0 && <Badge>{approvals.length}</Badge>}
				</h2>
				{approvals.length === 0 && (
					<p className="text-sm text-muted-foreground">
						Nothing waiting on you.
					</p>
				)}
				<ItemGroup className="gap-2">
					{approvals.map((a) => (
						<Item key={a.id} variant="outline" size="sm" className="flex-wrap">
							<ItemContent className="min-w-48">
								<ItemTitle className="w-full">
									<span className="truncate">{a.title}</span>
								</ItemTitle>
								<ItemDescription className="truncate">
									{a.summary} · from{" "}
									<Link href={`/dashboard/routines/${id}/runs/${a.chatId}`}>
										run of {when(a.createdAt)}
									</Link>
								</ItemDescription>
							</ItemContent>
							<ItemActions>
								<Button
									size="sm"
									variant="outline"
									onClick={() => setReview(a)}
								>
									Review
								</Button>
								<Button
									size="sm"
									variant="ghost"
									disabled={busy === a.id}
									onClick={() => decide(a, "cancel")}
								>
									Cancel
								</Button>
								<Button
									size="sm"
									disabled={busy === a.id}
									onClick={() => decide(a, "approve")}
								>
									Approve
								</Button>
							</ItemActions>
						</Item>
					))}
				</ItemGroup>
			</section>

			<section className="flex flex-col gap-2">
				<h2 className="text-sm font-medium">Runs</h2>
				{runs.length === 0 && (
					<p className="text-sm text-muted-foreground">
						No runs yet. Press Run test to try it now.
					</p>
				)}
				<ItemGroup className="gap-2">
					{runs.map((run) => (
						<Item
							key={run.id}
							variant="outline"
							size="sm"
							render={
								<Link href={`/dashboard/routines/${id}/runs/${run.chatId}`} />
							}
						>
							<ItemContent>
								<ItemTitle>{when(run.startedAt)}</ItemTitle>
								{run.error && (
									<ItemDescription className="truncate">
										{run.error}
									</ItemDescription>
								)}
							</ItemContent>
							<ItemActions>
								{run.trigger !== "schedule" && (
									<Badge variant="secondary">test</Badge>
								)}
								<Badge variant={STATUS[run.status]?.variant ?? "outline"}>
									{STATUS[run.status]?.label ?? run.status}
								</Badge>
							</ItemActions>
						</Item>
					))}
				</ItemGroup>
			</section>

			<Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete “{r.name}”?</DialogTitle>
						<DialogDescription>
							This deletes the routine, all {stats.runs} of its run chats and
							their files, and any drafts waiting on you. It can't be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirmDelete(false)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={busy === "delete"}
							onClick={remove}
						>
							{busy === "delete" ? "Deleting…" : "Delete routine"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={!!review} onOpenChange={(o) => !o && setReview(undefined)}>
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>{review?.title}</DialogTitle>
						<DialogDescription>{review?.summary}</DialogDescription>
					</DialogHeader>
					<pre className="max-h-[50vh] overflow-auto rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
						{review?.preview}
					</pre>
					<DialogFooter>
						<Button
							variant="outline"
							disabled={!!busy}
							onClick={() => review && decide(review, "cancel")}
						>
							Cancel draft
						</Button>
						<Button
							disabled={!!busy}
							onClick={() => review && decide(review, "approve")}
						>
							Approve
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
