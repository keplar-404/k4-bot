ALTER TABLE "bot" ADD COLUMN "subagents_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bot" ADD COLUMN "max_subagents" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "bot" ADD COLUMN "max_parallel_tools" integer DEFAULT 5 NOT NULL;