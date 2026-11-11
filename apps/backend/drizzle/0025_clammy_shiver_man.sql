CREATE TABLE "assistant_memory" (
	"user_id" text PRIMARY KEY NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_message" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"todos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"run_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_run" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"user_id" text NOT NULL,
	"workflow_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"todos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"question" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "assistant_thread" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'New chat' NOT NULL,
	"workflow_id" text,
	"model_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow" ADD COLUMN "assistant_run_id" text;--> statement-breakpoint
ALTER TABLE "assistant_memory" ADD CONSTRAINT "assistant_memory_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_message" ADD CONSTRAINT "assistant_message_thread_id_assistant_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."assistant_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_run" ADD CONSTRAINT "assistant_run_thread_id_assistant_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."assistant_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_thread" ADD CONSTRAINT "assistant_thread_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_thread" ADD CONSTRAINT "assistant_thread_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_message_thread_idx" ON "assistant_message" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "assistant_run_user_idx" ON "assistant_run" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "assistant_run_thread_idx" ON "assistant_run" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "assistant_thread_user_idx" ON "assistant_thread" USING btree ("user_id","updated_at");