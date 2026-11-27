CREATE TABLE "user_routine" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"instructions" text NOT NULL,
	"start_at" text NOT NULL,
	"repeat" text NOT NULL,
	"timezone" text NOT NULL,
	"next_run_at" timestamp,
	"enabled" boolean DEFAULT true NOT NULL,
	"steps" text DEFAULT '' NOT NULL,
	"auto_ok" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_routine_approval" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"routine_id" text NOT NULL,
	"run_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"preview" text NOT NULL,
	"action" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_routine_run" (
	"id" text PRIMARY KEY NOT NULL,
	"routine_id" text NOT NULL,
	"user_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"session_id" text,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	CONSTRAINT "user_routine_run_chat_id_unique" UNIQUE("chat_id"),
	CONSTRAINT "user_routine_run_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE INDEX "user_routine_user_idx" ON "user_routine" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_routine_due_idx" ON "user_routine" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "user_routine_approval_user_idx" ON "user_routine_approval" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_routine_run_routine_idx" ON "user_routine_run" USING btree ("routine_id","started_at");