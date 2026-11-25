// The chat's mode, set per message by channels/eve.ts from the web picker.
// Plan offers only web reading: every other tool returns null from defineDynamic,
// so the model never sees it (eve docs: dynamic-configuration). Ask and Full get
// every tool; agent.ts asks before writes in Ask.
type Session = {
	auth: { current?: { attributes: Record<string, unknown> } | null };
};

const MODES = ["ask", "plan", "full"] as const;

/** Anything missing or unknown counts as Ask, never as Full. */
export const modeOf = (session: Session) =>
	MODES.find((m) => m === session.auth.current?.attributes.mode) ?? "ask";

/** For defineDynamic: the tool, or nothing in Plan mode. */
export const notInPlan =
	<T>(tool: T) =>
	(ctx: { session: Session }) =>
		modeOf(ctx.session) === "plan" ? null : tool;
