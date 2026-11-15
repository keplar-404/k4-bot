// App tables. Every row is owned by one user (userId), and every query filters by it.
import {
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// One chat = one eve session.
export const chat = pgTable(
	"chat",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
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
		userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
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
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	sandboxId: text("sandbox_id").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
