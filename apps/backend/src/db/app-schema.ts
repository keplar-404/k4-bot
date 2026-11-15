// App tables. Every row is owned by one user (userId), and every query filters by it.
// userId is the Neon Auth user id (neon_auth.user.id). There is no foreign key: that
// schema belongs to Neon, so we never link our tables to it.
import {
	bigint,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

// One chat = one eve session.
export const chat = pgTable(
	"chat",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		title: text("title").notNull(),
		eveSessionId: text("eve_session_id").unique(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [index("chat_userId_idx").on(t.userId)],
);

// Copy of every eve stream event (eve docs: Hooks > Persist events to your own
// database). (sessionId, line, index) is the event's stable stream position.
export const agentEvent = pgTable(
	"agent_event",
	{
		sessionId: text("session_id").notNull(),
		line: integer("line").notNull(),
		index: integer("index").notNull(),
		userId: text("user_id"),
		type: text("type").notNull(),
		data: jsonb("data"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.sessionId, t.line, t.index] }),
		index("agent_event_userId_idx").on(t.userId),
	],
);

// eve fileMemory documents (custom backend, eve docs memory/file). `key` is
// eve's opaque per-scope key; scope is per signed-in user (byPrincipal).
export const agentMemory = pgTable("agent_memory", {
	key: text("key").primaryKey(),
	content: text("content").notNull(),
	version: integer("version").notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Each user's own Linux desktop (E2B), created at sign-up and kept paused.
export const userDesktop = pgTable("user_desktop", {
	userId: text("user_id").primaryKey(),
	sandboxId: text("sandbox_id").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Per-user request counters (see rate-limit.ts).
export const rateLimit = pgTable("rate_limit", {
	id: text("id").primaryKey(),
	key: text("key").notNull().unique(),
	count: integer("count").notNull(),
	lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
