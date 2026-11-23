"use client";

import { findModel } from "@repo/shared/models";
import { runs, type SessionView, turns, usage } from "eve/events";
import { FootprintsIcon, LayersIcon } from "lucide-react";

const fmt = new Intl.NumberFormat("en", { notation: "compact" });

// One line under the prompt bar. eve folds the stream into the view, so every
// number is a selector read: turns, model runs (steps), session usage, and the
// last run's input against its model's window.
export function ChatStats({ view }: { view: SessionView }) {
	const all = runs(view);
	if (all.length === 0) return null;
	const total = usage(view).total;
	const last = all.findLast((r) => r.usage);
	const context = last?.usage
		? last.usage.inputTokens / findModel(last.modelId).contextWindow
		: undefined;
	const ms =
		last?.startedAt && last.endedAt
			? Date.parse(last.endedAt) - Date.parse(last.startedAt)
			: 0;
	const tps = last?.usage && ms > 0 ? last.usage.outputTokens / (ms / 1000) : 0;
	const tokens = total.inputTokens + total.outputTokens;
	return (
		<p className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5 text-xs text-muted-foreground tabular-nums">
			<span className="flex items-center gap-1.5">
				<FootprintsIcon aria-hidden className="size-3" />
				{turns(view).length} turns · {all.length} steps
				{tps > 0 && ` · ${Math.round(tps)} tok/s`}
			</span>
			<span className="flex items-center gap-1.5">
				<LayersIcon aria-hidden className="size-3" />
				{fmt.format(tokens)} tok
				{total.inputTokens > 0 &&
					` · cache ${Math.round((total.cacheReadTokens / total.inputTokens) * 100)}%`}
			</span>
			{context !== undefined && (
				<span className="flex items-center gap-1.5" title="Context used">
					{/* A ring that fills with the context used; pathLength makes the dash a percent. */}
					<svg aria-hidden viewBox="0 0 16 16" className="size-3 -rotate-90">
						<circle
							cx="8"
							cy="8"
							r="6.5"
							fill="none"
							strokeWidth="2.5"
							className="stroke-muted"
						/>
						<circle
							cx="8"
							cy="8"
							r="6.5"
							fill="none"
							strokeWidth="2.5"
							pathLength={100}
							strokeDasharray={`${Math.min(context, 1) * 100} 100`}
							className="stroke-current"
						/>
					</svg>
					<span className="sr-only">Context used</span>
					{Math.round(context * 100)}%
				</span>
			)}
		</p>
	);
}
