// App tables, shared by apps/backend (migrations, API) and apps/ai-agent. Every row is
// owned by one user (userId), and every query filters by it. userId is the Neon Auth user
// id (neon_auth.user.id); no foreign key, because that schema belongs to Neon.
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
		// The event's turn/run ids. Saved with type and data so the web app can hand
		// these rows back to eve as initialEvents when a chat opens.
		scope: jsonb("scope"),
		data: jsonb("data"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.sessionId, t.line, t.index] }),
		index("agent_event_userId_idx").on(t.userId),
	],
);

// What the agent remembers about each user: plain text, one fact per line. The
// agent's memory provider (apps/ai-agent/agent/memory/profile.ts) and the user's
// Settings > Memory (PUT /api/me/memory) both read and write this row.
export const agentMemory = pgTable("agent_memory", {
	userId: text("user_id").primaryKey(),
	content: text("content").notNull().default(""),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

// Per-user request counters (see rate-limit.ts in this package).
export const rateLimit = pgTable("rate_limit", {
	id: text("id").primaryKey(),
	key: text("key").notNull().unique(),
	count: integer("count").notNull(),
	lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
