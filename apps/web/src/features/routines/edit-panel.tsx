"use client";

// Routines plug-in: the right panel's "Edit routine" tab, on a routine's page and its run chats.
// The run page sets which routine it is (useEditRoutine) and opens the tab.
import { ClockIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { closePanelTab, openPanelTab } from "@/lib/chat-ui";
import { refreshRoutines, useRoutine } from "./data";
import { type Repeat, RepeatPicker, timezone } from "./timing";

// Which routine the open run chat belongs to (none outside run chats). `owner` is the
// run chat that set it: when one run chat replaces another, the old one's cleanup can
// run after the new one's setup, and must not close the new one's tab.
const useCurrentStore = create<{ id?: string; owner?: object }>(() => ({}));
const useCurrent = () => useCurrentStore((s) => s.id);

/** In a run's chat: show the Edit routine tab for this routine while mounted. */
export function useEditRoutine(routineId: string) {
	useEffect(() => {
		const owner = {};
		useCurrentStore.setState({ id: routineId, owner });
		// A run may have just saved new steps: don't show the cached copy.
		refreshRoutines(routineId);
		openPanelTab("routine");
		return () => {
			if (useCurrentStore.getState().owner !== owner) return;
			useCurrentStore.setState({ id: undefined, owner: undefined });
			closePanelTab("routine");
		};
	}, [routineId]);
}

export function RoutineEditPanel() {
	const id = useCurrent();
	const { data } = useRoutine(id);
	const r = data?.routine;
	const [form, setForm] = useState<{
		name: string;
		instructions: string;
		startAt: string;
		repeat: Repeat;
	}>();
	const [busy, setBusy] = useState(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset when the routine changes, not on every refresh
	useEffect(() => {
		if (r)
			setForm({
				name: r.name,
				instructions: r.instructions,
				startAt: r.startAt,
				repeat: r.repeat as Repeat,
			});
	}, [r?.id]);
	if (!id)
		return (
			<p className="p-4 text-sm text-muted-foreground">
				Open a routine run to edit it.
			</p>
		);
	if (!form)
		return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
	const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
		setForm({ ...form, [k]: e.target.value });

	async function save() {
		if (!id || !form) return;
		setBusy(true);
		const res = await api.api.routines[":id"]
			.$patch({ param: { id }, json: { ...form, timezone: timezone() } })
			.catch(() => undefined);
		setBusy(false);
		if (!res?.ok) return toast.error("Could not save the routine.");
		toast.success("Routine saved");
		refreshRoutines(id);
	}

	return (
		<div className="flex w-full min-w-0 flex-col gap-4 p-4">
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="edit-name">Name</FieldLabel>
					<Input
						id="edit-name"
						maxLength={60}
						value={form.name}
						onChange={set("name")}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="edit-instructions">Instructions</FieldLabel>
					<Textarea
						id="edit-instructions"
						rows={4}
						maxLength={4000}
						value={form.instructions}
						onChange={set("instructions")}
					/>
				</Field>
				<Note
					label="Steps that worked"
					text={r?.steps}
					empty="The assistant saves these after a run succeeds."
					hint="Written by the assistant. Given to every new run."
				/>
				<Note
					label="No approval needed for"
					text={r?.autoOk}
					empty="The assistant lists these after a run succeeds."
					hint="Written by the assistant. Sending, posting, merging and deleting always ask you."
				/>
				<Field>
					<FieldLabel htmlFor="edit-start">First run</FieldLabel>
					<Input
						id="edit-start"
						type="datetime-local"
						value={form.startAt}
						onChange={set("startAt")}
					/>
				</Field>
				<Field>
					<FieldLabel>Repeat</FieldLabel>
					<RepeatPicker
						value={form.repeat}
						onChange={(repeat) => setForm({ ...form, repeat })}
					/>
				</Field>
			</FieldGroup>
			<Button
				onClick={save}
				disabled={busy || !form.name.trim() || !form.instructions.trim()}
			>
				{busy ? "Saving…" : "Save"}
			</Button>
		</div>
	);
}

// The agent's notes: read-only here, live (the store refreshes while a run is going).
function Note({
	label,
	text,
	empty,
	hint,
}: {
	label: string;
	text?: string;
	empty: string;
	hint: string;
}) {
	return (
		<Field>
			<FieldLabel>{label}</FieldLabel>
			<p className="rounded-md border bg-muted/50 px-3 py-2 text-sm whitespace-pre-wrap text-muted-foreground">
				{text || empty}
			</p>
			<FieldDescription>{hint}</FieldDescription>
		</Field>
	);
}

/** The Start tab's card for Edit routine: only in a run's chat, styled like its others. */
export function RoutineStartCard() {
	if (!useCurrent()) return null;
	return (
		<button
			type="button"
			data-glide-item
			onClick={() => openPanelTab("routine")}
			className="flex w-full items-center gap-4 rounded-xl border bg-card px-5 py-4 text-left text-card-foreground transition-colors hover:bg-accent"
		>
			<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
				<ClockIcon className="size-4" aria-hidden />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block font-medium">Edit routine</span>
				<span className="block text-xs text-muted-foreground">
					Name, instructions, schedule and saved steps
				</span>
			</span>
		</button>
	);
}
