ALTER TABLE "assistant_message" ADD COLUMN "parts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_run" ADD COLUMN "parts" jsonb DEFAULT '[]'::jsonb NOT NULL;