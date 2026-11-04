CREATE TABLE "bot_sandbox" (
	"bot_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"sandbox_id" text NOT NULL,
	"status" text DEFAULT 'creating' NOT NULL,
	"purpose" text NOT NULL,
	"template" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bot_sandbox" ADD CONSTRAINT "bot_sandbox_bot_id_bot_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_sandbox" ADD CONSTRAINT "bot_sandbox_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bot_sandbox_userId_idx" ON "bot_sandbox" USING btree ("user_id");