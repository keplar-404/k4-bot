ALTER TABLE "agent_usage" DROP CONSTRAINT "agent_usage_thread_id_chat_thread_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_usage" ALTER COLUMN "thread_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_usage" ADD CONSTRAINT "agent_usage_thread_id_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE set null ON UPDATE no action;