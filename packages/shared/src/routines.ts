// Routines: agent runs on a schedule (or on "Run test"), each run its own chat. A plug-in
// module: its tables live here, apart from schema.ts, and nothing else depends on them.
// Every row is owned by one user (userId); every query filters by it.
import { and, eq, sql } from "drizzle-orm";
import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import type { Db } from "./db";

export const REPEATS = [
	"once",
	"daily",
	"weekdays",
	"weekly",
	"monthly",
] as const;
export type Repeat = (typeof REPEATS)[number];
export const MAX_ROUTINES = 10;
export const MAX_NOTES = 2000; // steps and the no-approval list, each

export const routine = pgTable(
	"user_routine",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		name: text("name").notNull(),
		instructions: text("instructions").notNull(),
		// The first run, as a wall-clock time in `timezone` (YYYY-MM-DDTHH:mm).
		startAt: text("start_at").notNull(),
		repeat: text("repeat").$type<Repeat>().notNull(),
		timezone: text("timezone").notNull(),
		// When the dispatcher starts it next; null once a one-time routine has run.
		nextRunAt: timestamp("next_run_at"),
		enabled: boolean("enabled").notNull().default(true),
		// Written by the agent in routine runs (routine_steps, routine_auto_ok tools) and
		// editable by the user. Notes for the next run, never rules.
		steps: text("steps").notNull().default(""),
		autoOk: text("auto_ok").notNull().default(""),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("user_routine_user_idx").on(t.userId),
		index("user_routine_due_idx").on(t.nextRunAt),
	],
);

export type RunStatus = "running" | "ok" | "failed" | "needs_you";
export const routineRun = pgTable(
	"user_routine_run",
	{
		id: text("id").primaryKey(),
		routineId: text("routine_id").notNull(),
		userId: text("user_id").notNull(),
		// The run's chat (chat.id). Hidden from Recent because it has a row here.
		chatId: text("chat_id").notNull().unique(),
		sessionId: text("session_id").unique(),
		trigger: text("trigger").$type<"schedule" | "test" | "agent">().notNull(),
		status: text("status").$type<RunStatus>().notNull().default("running"),
		error: text("error"),
		startedAt: timestamp("started_at").defaultNow().notNull(),
		endedAt: timestamp("ended_at"),
	},
	(t) => [index("user_routine_run_routine_idx").on(t.routineId, t.startedAt)],
);

// A draft that needs the user: what they see (preview) and, for app actions, the exact
// Composio tool + inputs that Approve runs once. kind "chat": Approve opens the run's chat.
export type ApprovalAction = {
	tool: string;
	arguments: Record<string, unknown>;
};
export type ApprovalStatus =
	| "pending"
	| "approved"
	| "cancelled"
	| "done"
	| "failed";
export const routineApproval = pgTable(
	"user_routine_approval",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		routineId: text("routine_id").notNull(),
		runId: text("run_id").notNull(),
		chatId: text("chat_id").notNull(),
		title: text("title").notNull(),
		summary: text("summary").notNull(),
		preview: text("preview").notNull(),
		action: jsonb("action").$type<ApprovalAction | null>(),
		status: text("status").$type<ApprovalStatus>().notNull().default("pending"),
		result: text("result"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		decidedAt: timestamp("decided_at"),
	},
	(t) => [index("user_routine_approval_user_idx").on(t.userId, t.status)],
);

// Drafts older than this can't be approved: the facts behind them may have changed.
export const APPROVAL_TTL_MS = 7 * 24 * 60 * 60_000;

/**
 * App actions a routine run may never do on its own: it saves a draft with
 * request_approval instead. Matched on whole words of a Composio slug
 * (GMAIL_SEND_EMAIL, SLACK_CHAT_POST_MESSAGE, GITHUB_MERGE_A_PULL_REQUEST).
 */
const NEEDS_USER =
	/(^|_)(SEND|REPLY|FORWARD|POST|PUBLISH|SHARE|INVITE|MERGE|DELETE|REMOVE|TRASH|TRANSFER|PAY|CHARGE|REFUND|TWEET|RETWEET|COMMENT|REVIEW|APPROVE|CLOSE|ARCHIVE|BAN|KICK)(_|$)/;
export const needsUser = (slug: string) => NEEDS_USER.test(slug.toUpperCase());

/** Every Composio tool slug inside a tool call's input (multi-execute or use_connector). */
export function slugsIn(input: unknown): string[] {
	if (!input || typeof input !== "object") return [];
	const i = input as { tools?: unknown; tool?: unknown };
	const out: string[] = [];
	if (typeof i.tool === "string") out.push(i.tool);
	if (Array.isArray(i.tools))
		for (const t of i.tools)
			if (t && typeof t === "object" && "tool_slug" in t)
				out.push(String((t as { tool_slug: unknown }).tool_slug));
	return out;
}

// ---- Time: a wall-clock time in an IANA timezone, without a date library ----

/** Minutes the timezone is ahead of UTC at `at`. */
function offsetMinutes(at: Date, timeZone: string) {
	const p = Object.fromEntries(
		new Intl.DateTimeFormat("en-US", {
			timeZone,
			hourCycle: "h23",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		})
			.formatToParts(at)
			.map((x) => [x.type, x.value]),
	);
	const asUtc = Date.UTC(
		+p.year,
		+p.month - 1,
		+p.day,
		+p.hour,
		+p.minute,
		+p.second,
	);
	return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The instant a wall-clock time happens in `timeZone`. */
export function zonedTime(
	y: number,
	m: number,
	d: number,
	h: number,
	min: number,
	timeZone: string,
) {
	const guess = Date.UTC(y, m - 1, d, h, min);
	const first = guess - offsetMinutes(new Date(guess), timeZone) * 60_000;
	// Again with the offset at the result, for days that change offset (DST).
	return new Date(guess - offsetMinutes(new Date(first), timeZone) * 60_000);
}

export const validTimezone = (tz: string) => {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: tz });
		return true;
	} catch {
		return false;
	}
};

const START = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
export const validStart = (s: string) => START.test(s);

/** The first run strictly after `after`, or null (a one-time routine that already ran). */
export function nextRun(
	r: { startAt: string; repeat: Repeat; timezone: string },
	after: Date,
): Date | null {
	const m = START.exec(r.startAt);
	if (!m) return null;
	const [y, mo, d, h, mi] = m.slice(1).map(Number);
	const at = (yy: number, mm: number, dd: number) =>
		zonedTime(yy, mm, dd, h, mi, r.timezone);
	const first = at(y, mo, d);
	if (r.repeat === "once") return first > after ? first : null;
	const startDay = Date.UTC(y, mo - 1, d);
	const startWeekday = new Date(startDay).getUTCDay();
	// Walk local calendar days from the start (or about today) until one matches.
	const today = Math.max(
		startDay,
		Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate()) -
			86_400_000,
	);
	for (let day = today, n = 0; n < 400; day += 86_400_000, n++) {
		const c = new Date(day);
		const wd = c.getUTCDay();
		const ok =
			r.repeat === "daily" ||
			(r.repeat === "weekdays" && wd >= 1 && wd <= 5) ||
			(r.repeat === "weekly" && wd === startWeekday) ||
			(r.repeat === "monthly" && c.getUTCDate() === d);
		if (!ok) continue;
		const t = at(c.getUTCFullYear(), c.getUTCMonth() + 1, c.getUTCDate());
		if (t > after && t >= first) return t;
	}
	return null;
}

// ---- Queries shared by the backend and the agent ----

/** The routine run a session belongs to, with its routine, or null. */
export async function runOfSession(db: Db, sessionId: string) {
	const [row] = await db
		.select({ run: routineRun, routine })
		.from(routineRun)
		.innerJoin(routine, eq(routine.id, routineRun.routineId))
		.where(eq(routineRun.sessionId, sessionId))
		.limit(1);
	return row ?? null;
}

/** Same, by run id, for sessions whose id isn't saved yet (scheduled runs). */
export async function runById(db: Db, runId: string, userId: string) {
	const [row] = await db
		.select({ run: routineRun, routine })
		.from(routineRun)
		.innerJoin(routine, eq(routine.id, routineRun.routineId))
		.where(and(eq(routineRun.id, runId), eq(routineRun.userId, userId)))
		.limit(1);
	return row ?? null;
}

/**
 * Starts a run's records: its chat (as any chat) and its run row. Returns what the
 * caller sends to the agent. Both rows in one statement, so neither exists alone.
 */
export async function createRun(
	db: Db,
	r: { id: string; userId: string; name: string; instructions: string },
	trigger: "schedule" | "test" | "agent",
) {
	const runId = crypto.randomUUID();
	const chatId = crypto.randomUUID();
	const when = new Date().toISOString().slice(0, 16).replace("T", " ");
	await db.execute(sql`
		with c as (
			insert into chat (id, user_id, title)
			values (${chatId}, ${r.userId}, ${`${r.name} · ${when}`})
			returning id
		)
		insert into user_routine_run (id, routine_id, user_id, chat_id, trigger)
		select ${runId}, ${r.id}, ${r.userId}, c.id, ${trigger} from c`);
	return { runId, chatId, prompt: r.instructions };
}
