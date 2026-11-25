import type { EveMessagePart, UseEveAgentReturn } from "eve/react";

export type Step = Exclude<EveMessagePart, { type: "file" }>;

/** Part id or call id -> the order in which it first appeared on the stream. */
export type StartOrder = ReadonlyMap<string, number>;

// eve sorts a turn's parts by when each was recorded, and a thinking block is
// recorded when it ends: after the calls that followed it. The stream itself
// knows the real order. A part's first delta (or a call's first input) is the
// moment it started, and eve stores and replays those lines on reload.
export function startOrder(events: UseEveAgentReturn["events"]): StartOrder {
	const order = new Map<string, number>();
	for (const e of events) {
		const d = e.data as { partId?: unknown; callId?: unknown } | undefined;
		const id =
			e.type === "content.delta" || e.type === "content.completed"
				? d?.partId
				: e.type === "call.input" || e.type === "call.requested"
					? d?.callId
					: undefined;
		if (typeof id === "string" && !order.has(id)) order.set(id, order.size);
	}
	return order;
}

// Fallback when the stream doesn't name a part (imported history): within a
// step, thinking, then narration, then calls.
const RANK = { reasoning: 0, text: 1, tool: 2, interaction: 2 } as const;

const idOf = (p: Step) =>
	p.type === "tool" ? p.callId : p.type === "interaction" ? undefined : p.id;

export function splitTurn(
	parts: readonly EveMessagePart[],
	order: StartOrder = new Map(),
) {
	let step = 0;
	const rows = parts
		.filter(
			(p): p is Step =>
				p.type !== "file" &&
				!(p.type === "tool" && p.hidden) &&
				// Providers emit empty (redacted) reasoning parts around tool calls.
				!(p.type === "reasoning" && !p.text.trim()),
		)
		.map((p) => {
			// A part without a stepIndex stays in the step of the part before it.
			step = ("stepIndex" in p ? p.stepIndex : undefined) ?? step;
			const id = idOf(p);
			return { p, step, at: id === undefined ? undefined : order.get(id) };
		});
	// Real start order only when every part in the step has one; mixing it with
	// the rule could order a step inconsistently.
	const known = new Map<number, boolean>();
	for (const r of rows)
		known.set(r.step, (known.get(r.step) ?? true) && r.at !== undefined);
	const visible = rows
		.sort(
			(a, b) =>
				a.step - b.step ||
				(known.get(a.step)
					? (a.at ?? 0) - (b.at ?? 0)
					: RANK[a.p.type] - RANK[b.p.type]),
		)
		.map((r) => r.p);
	// Everything up to the last non-text part is steps (text in there is the
	// agent narrating between calls). The text after it is the final reply.
	const last = visible.findLastIndex((p) => p.type !== "text");
	return {
		steps: visible.slice(0, last + 1),
		reply: visible
			.slice(last + 1)
			.flatMap((p) => (p.type === "text" ? [p.text] : []))
			.join(""),
	};
}
