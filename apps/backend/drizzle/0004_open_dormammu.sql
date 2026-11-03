ALTER TABLE "bot" ADD COLUMN "role" text DEFAULT 'assistant' NOT NULL;--> statement-breakpoint
ALTER TABLE "bot" ADD COLUMN "role_title" text;