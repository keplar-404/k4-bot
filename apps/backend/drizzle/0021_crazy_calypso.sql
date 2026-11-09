CREATE TABLE "admin_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"bot_id" text,
	"action" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_group" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"lead_bot_id" text,
	"memory" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_group_member" (
	"group_id" text NOT NULL,
	"bot_id" text NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bot_group_member_group_id_bot_id_pk" PRIMARY KEY("group_id","bot_id")
);
--> statement-breakpoint
ALTER TABLE "bot" ADD COLUMN "kind" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "author_bot_id" text;--> statement-breakpoint
ALTER TABLE "chat_thread" ADD COLUMN "group_id" text;--> statement-breakpoint
ALTER TABLE "admin_audit" ADD CONSTRAINT "admin_audit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_group" ADD CONSTRAINT "bot_group_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_group" ADD CONSTRAINT "bot_group_lead_bot_id_bot_id_fk" FOREIGN KEY ("lead_bot_id") REFERENCES "public"."bot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_group_member" ADD CONSTRAINT "bot_group_member_group_id_bot_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."bot_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_group_member" ADD CONSTRAINT "bot_group_member_bot_id_bot_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_userId_idx" ON "admin_audit" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "bot_group_userId_idx" ON "bot_group" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bot_group_member_botId_idx" ON "bot_group_member" USING btree ("bot_id");--> statement-breakpoint
ALTER TABLE "chat_thread" ADD CONSTRAINT "chat_thread_group_id_bot_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."bot_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bot_one_admin_per_user" ON "bot" USING btree ("user_id") WHERE "bot"."kind" = 'admin';--> statement-breakpoint
CREATE INDEX "chat_thread_groupId_idx" ON "chat_thread" USING btree ("group_id");