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
	// Every query starts with session_id, so the primary key serves them all.
	(t) => [primaryKey({ columns: [t.sessionId, t.line, t.index] })],
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

// Each user's one cloud computer (an E2B desktop), shared by all their chats and
// agents. Paused when idle; E2B resumes it when any tool connects again.
export const userComputer = pgTable("user_computer", {
	userId: text("user_id").primaryKey(),
	sandboxId: text("sandbox_id").notNull(),
	// The live view's VNC password: only GET /api/me/computer hands it out, to the owner.
	streamPassword: text("stream_password").notNull(),
	// Signs the live view's short tokens (websockify JWTTokenApi in the computer).
	// Never leaves the backend. Null on computers made before the direct stream.
	streamKey: text("stream_key"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Composio's app list, so the prompt bar's @ menu doesn't ask Composio each time.
// "catalog": every app (slug, name, logo), the same for all users, refreshed daily.
// "connected:<userId>": that user's connected slugs, cleared on connect/disconnect.
export const appCache = pgTable("app_cache", {
	key: text("key").primaryKey(),
	data: jsonb("data").notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Per-user request counters (see rate-limit.ts in this package).
export const rateLimit = pgTable("rate_limit", {
	key: text("key").primaryKey(),
	count: integer("count").notNull(),
	lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// Skills each user uploaded (@repo/shared/skills). The files are in R2 under `prefix`
// (skillPrefix: a fresh folder per upload, so a failed re-upload keeps the old one);
// this row is what the agent searches and loads by.
export const userSkill = pgTable(
	"user_skill",
	{
		userId: text("user_id").notNull(),
		name: text("name").notNull(),
		description: text("description").notNull(),
		prefix: text("prefix").notNull(),
		// Every file in the skill folder (path, bytes, type), for the agent's file list.
		files: jsonb("files")
			.$type<{ path: string; size: number; type: string }[]>()
			.notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [primaryKey({ columns: [t.userId, t.name] })],
);

// MCP servers each user added (Settings > Custom connectors), for apps Composio doesn't
// have. Composio hosts them (Custom MCP toolkits, apps/backend/src/mcp.ts): it keeps the
// keys and sign-ins and makes the calls. This row only says which user added which.
export const userMcp = pgTable(
	"user_mcp",
	{
		userId: text("user_id").notNull(),
		name: text("name").notNull(),
		url: text("url").notNull(),
		// The Composio toolkit (CUSTOM_…). On the free plan one toolkit per URL is shared
		// by all users, so several rows can hold the same slug.
		slug: text("slug").notNull(),
		// How the user connects: "none", "key" (on Composio's page) or "oauth".
		auth: text("auth").$type<"none" | "key" | "oauth">().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.name] }),
		index("user_mcp_slug_idx").on(t.slug),
	],
);
