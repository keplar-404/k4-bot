CREATE TABLE "run_trace" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"run_id" text NOT NULL,
	"thread_id" text,
	"user_id" text NOT NULL,
	"model_id" text,
	"status" text NOT NULL,
	"slices" integer DEFAULT 0 NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"stop_reason" text,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"meta" jsonb
);
--> statement-breakpoint
CREATE INDEX "run_trace_user_time_idx" ON "run_trace" USING btree ("user_id","started_at");