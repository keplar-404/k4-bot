"use client";

// Routines plug-in: the New routine popup. On Create, opens the new routine's page.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { refreshRoutines } from "./data";
import { type Repeat, RepeatPicker, timezone } from "./timing";

// Tomorrow 09:00 local, as a datetime-local value.
const tomorrowNine = () => {
	const d = new Date(Date.now() + 86_400_000);
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T09:00`;
};

export function CreateRoutineDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const router = useRouter();
	const [name, setName] = useState("");
	const [instructions, setInstructions] = useState("");
	const [startAt, setStartAt] = useState(tomorrowNine);
	const [repeat, setRepeat] = useState<Repeat>("daily");
	const [busy, setBusy] = useState(false);

	async function create(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		const res = await api.api.routines
			.$post({
				json: { name, instructions, startAt, repeat, timezone: timezone() },
			})
			.catch(() => undefined);
		setBusy(false);
		if (!res?.ok) {
			const body = (await res?.json().catch(() => ({}))) as
				| { error?: string }
				| undefined;
			return toast.error(body?.error ?? "Could not create the routine.");
		}
		const { id } = (await res.json()) as { id: string };
		refreshRoutines();
		onOpenChange(false);
		setName("");
		setInstructions("");
		router.push(`/dashboard/routines/${id}`);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<form onSubmit={create} className="flex flex-col gap-4">
					<DialogHeader>
						<DialogTitle>New routine</DialogTitle>
						<DialogDescription>
							The assistant runs this on its own, at the time you pick. Each run
							gets its own chat.
						</DialogDescription>
					</DialogHeader>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="routine-name">Name</FieldLabel>
							<Input
								id="routine-name"
								required
								maxLength={60}
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Morning brief"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="routine-instructions">
								Instructions
							</FieldLabel>
							<Textarea
								id="routine-instructions"
								required
								maxLength={4000}
								rows={4}
								value={instructions}
								onChange={(e) => setInstructions(e.target.value)}
								placeholder="Read my unread email and today's calendar, and send me a short brief on Slack."
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="routine-start">First run</FieldLabel>
							<Input
								id="routine-start"
								type="datetime-local"
								required
								value={startAt}
								onChange={(e) => setStartAt(e.target.value)}
							/>
							<FieldDescription>Your time zone: {timezone()}</FieldDescription>
						</Field>
						<Field>
							<FieldLabel>Repeat</FieldLabel>
							<RepeatPicker value={repeat} onChange={setRepeat} />
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={busy || !name.trim() || !instructions.trim()}
						>
							{busy ? "Creating…" : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
