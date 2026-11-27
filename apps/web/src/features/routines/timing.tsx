"use client";

// Routines plug-in: the Repeat choice and how a routine's timing reads.
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const REPEATS = [
	"once",
	"daily",
	"weekdays",
	"weekly",
	"monthly",
] as const;
export type Repeat = (typeof REPEATS)[number];
const LABEL: Record<Repeat, string> = {
	once: "Once",
	daily: "Daily",
	weekdays: "Weekdays",
	weekly: "Weekly",
	monthly: "Monthly",
};

export const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function RepeatPicker({
	value,
	onChange,
}: {
	value: Repeat;
	onChange: (r: Repeat) => void;
}) {
	return (
		<ToggleGroup
			variant="outline"
			size="sm"
			className="flex-wrap"
			value={[value]}
			onValueChange={(v: string[]) => v[0] && onChange(v[0] as Repeat)}
		>
			{REPEATS.map((r) => (
				<ToggleGroupItem key={r} value={r} aria-label={LABEL[r]}>
					{LABEL[r]}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}

/** "Weekdays at 09:00", "Once on 2026-12-01 at 09:00". */
export function describeTiming(r: { startAt: string; repeat: Repeat }) {
	const [date, time] = r.startAt.split("T");
	if (r.repeat === "once") return `Once on ${date} at ${time}`;
	if (r.repeat === "weekly")
		return `Every ${new Date(`${date}T12:00`).toLocaleDateString(undefined, { weekday: "long" })} at ${time}`;
	if (r.repeat === "monthly")
		return `Monthly on day ${Number(date.slice(8))} at ${time}`;
	return `${LABEL[r.repeat]} at ${time}`;
}
