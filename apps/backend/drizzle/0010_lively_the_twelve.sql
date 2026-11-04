ALTER TABLE "bot_sandbox" ADD COLUMN "usage_day" text;--> statement-breakpoint
ALTER TABLE "bot_sandbox" ADD COLUMN "usage_seconds" integer DEFAULT 0 NOT NULL;