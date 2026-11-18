CREATE TABLE IF NOT EXISTS "file" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX IF EXISTS "file_userId_idx";--> statement-breakpoint
ALTER TABLE "rate_limit" DROP CONSTRAINT "rate_limit_key_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "agent_event_userId_idx";--> statement-breakpoint
ALTER TABLE "rate_limit" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "rate_limit" ADD PRIMARY KEY ("key");