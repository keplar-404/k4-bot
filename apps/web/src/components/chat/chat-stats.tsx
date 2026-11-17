"use client";

import { findModel } from "@repo/shared/models";
import { runs, type SessionView, turns, usage } from "eve/events";

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
		<p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
			<span>
				{turns(view).length} turns · {all.length} steps
				{tps > 0 && ` · ${Math.round(tps)} tok/s`}
			</span>
			<span>
				{fmt.format(tokens)} tok
				{total.inputTokens > 0 &&
					` · cache ${Math.round((total.cacheReadTokens / total.inputTokens) * 100)}%`}
			</span>
			{context !== undefined && (
				<span className="flex items-center gap-1.5">
					<meter
						aria-label="Context used"
						value={Math.min(context, 1)}
						className="h-1.5 w-16 appearance-none overflow-hidden rounded-full bg-muted [&::-moz-meter-bar]:bg-primary [&::-webkit-meter-bar]:bg-muted [&::-webkit-meter-optimum-value]:bg-primary"
					/>
					{Math.round(context * 100)}%
				</span>
			)}
		</p>
	);
}
