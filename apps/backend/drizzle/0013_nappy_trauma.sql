CREATE TABLE "research_task" (
	"thread_id" text NOT NULL,
	"input_hash" text NOT NULL,
	"user_id" text NOT NULL,
	"request_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"file_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "research_task_thread_id_input_hash_pk" PRIMARY KEY("thread_id","input_hash")
);
--> statement-breakpoint
ALTER TABLE "research_task" ADD CONSTRAINT "research_task_thread_id_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_task" ADD CONSTRAINT "research_task_file_id_chat_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."chat_file"("id") ON DELETE set null ON UPDATE no action;