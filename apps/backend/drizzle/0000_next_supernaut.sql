CREATE TABLE "agent_event" (
	"session_id" text NOT NULL,
	"line" integer NOT NULL,
	"index" integer NOT NULL,
	"user_id" text,
	"type" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_event_session_id_line_index_pk" PRIMARY KEY("session_id","line","index")
);
--> statement-breakpoint
CREATE TABLE "agent_memory" (
	"key" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"version" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"eve_session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_eve_session_id_unique" UNIQUE("eve_session_id")
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "user_desktop" (
	"user_id" text PRIMARY KEY NOT NULL,
	"sandbox_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agent_event_userId_idx" ON "agent_event" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_userId_idx" ON "chat" USING btree ("user_id");