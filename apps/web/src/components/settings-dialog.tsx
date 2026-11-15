"use client";

import { cn } from "cn";
import { BrainIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

// Left: sections. Right: the open section. Add a section to SECTIONS and a case below.
const SECTIONS = [{ id: "memory", label: "Memory", icon: BrainIcon }] as const;
type Section = (typeof SECTIONS)[number]["id"];

export function SettingsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [section, setSection] = useState<Section>("memory");
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[min(42rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl md:flex-row">
				<nav
					aria-label="Settings sections"
					className="flex shrink-0 gap-1 border-b p-3 md:w-52 md:flex-col md:border-r md:border-b-0"
				>
					<DialogTitle className="hidden px-2 pb-2 md:block">
						Settings
					</DialogTitle>
					{SECTIONS.map((s) => (
						<Button
							key={s.id}
							variant="ghost"
							aria-current={section === s.id ? "page" : undefined}
							className={cn("justify-start", section === s.id && "bg-muted")}
							onClick={() => setSection(s.id)}
						>
							<s.icon />
							{s.label}
						</Button>
					))}
				</nav>
				<div className="flex min-h-0 min-w-0 flex-1 flex-col p-6">
					{section === "memory" && open && <MemorySettings />}
				</div>
			</DialogContent>
		</Dialog>
	);
}

// What the agent remembers about the user (agent_memory in Neon). Read-only
// until Edit; Save replaces it, and the agent uses the new text from its next turn.
function MemorySettings() {
	const [saved, setSaved] = useState<string>();
	const [draft, setDraft] = useState("");
	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	// The limit comes from the backend, the one place it is defined.
	const [max, setMax] = useState<number>();

	useEffect(() => {
		void api.api.me.memory.$get().then(async (res) => {
			if (!res.ok) return toast.error("Could not load memory.");
			const { content, max } = await res.json();
			setMax(max);
			setSaved(content);
			setDraft(content);
		});
	}, []);

	async function save() {
		setSaving(true);
		const res = await api.api.me.memory
			.$put({ json: { content: draft } })
			.catch(() => undefined);
		setSaving(false);
		if (!res?.ok) return toast.error("Could not save memory. Try again.");
		const { content } = await res.json();
		setSaved(content);
		setDraft(content);
		setEditing(false);
		toast.success("Memory saved. The assistant uses it from its next reply.");
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4">
			<div className="flex flex-col gap-1 pr-8">
				<h3 className="font-heading text-base font-medium">Memory</h3>
				<DialogDescription>
					Preferences and facts the assistant has saved about you, one per line.
					It reads this at the start of every reply.
				</DialogDescription>
			</div>
			<Textarea
				aria-label="Saved memory"
				readOnly={!editing}
				value={saved === undefined ? "Loading…" : draft}
				onChange={(e) => setDraft(e.target.value)}
				placeholder="Nothing saved yet. Tell the assistant your preferences in a chat, or click Edit to add them here."
				maxLength={max}
				className={cn(
					"min-h-0 flex-1 resize-none [field-sizing:fixed] overflow-y-auto font-mono text-sm",
					!editing && "bg-muted/40 text-muted-foreground",
				)}
			/>
			<div className="flex items-center justify-end gap-2">
				{editing ? (
					<>
						<span className="mr-auto text-xs text-muted-foreground">
							{draft.length.toLocaleString()} / {max?.toLocaleString()}
						</span>
						<Button
							variant="outline"
							disabled={saving}
							onClick={() => {
								setDraft(saved ?? "");
								setEditing(false);
							}}
						>
							Cancel
						</Button>
						<Button disabled={saving || draft === saved} onClick={save}>
							{saving ? "Saving…" : "Save"}
						</Button>
					</>
				) : (
					<Button
						variant="outline"
						disabled={saved === undefined}
						onClick={() => setEditing(true)}
					>
						Edit
					</Button>
				)}
			</div>
		</div>
	);
}
