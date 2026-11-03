CREATE TABLE "chat_file" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"bot_id" text,
	"thread_id" text,
	"source" text NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"computer_path" text,
	"prompt" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_file" ADD CONSTRAINT "chat_file_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_file" ADD CONSTRAINT "chat_file_bot_id_bot_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_file" ADD CONSTRAINT "chat_file_thread_id_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_file_userId_createdAt_idx" ON "chat_file" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_file_botId_idx" ON "chat_file" USING btree ("bot_id");