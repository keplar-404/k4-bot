CREATE TABLE "composio_toolkit" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"logo" text,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tools_count" integer DEFAULT 0 NOT NULL,
	"triggers_count" integer DEFAULT 0 NOT NULL,
	"no_auth" boolean DEFAULT false NOT NULL,
	"rank" integer NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- IF NOT EXISTS: some databases already have this column from a `drizzle-kit push`.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "composio_session_id" text;--> statement-breakpoint
CREATE INDEX "composio_toolkit_rank_idx" ON "composio_toolkit" USING btree ("rank");