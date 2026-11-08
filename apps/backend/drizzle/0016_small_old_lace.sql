CREATE TABLE IF NOT EXISTS "user_secret" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"value" text NOT NULL,
	"hint" text,
	"created_by_bot_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bot_composio_app" (
	"bot_id" text NOT NULL,
	"toolkit" text NOT NULL,
	"connected_account_id" text,
	"allow_writes" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bot_composio_app_bot_id_toolkit_pk" PRIMARY KEY("bot_id","toolkit")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bot_workflow" (
	"bot_id" text NOT NULL,
	"workflow_id" text NOT NULL,
	"created_by_bot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bot_workflow_bot_id_workflow_id_pk" PRIMARY KEY("bot_id","workflow_id")
);
--> statement-breakpoint
ALTER TABLE "chat_thread" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'ask' NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_run" ADD COLUMN IF NOT EXISTS "started_by_bot_id" text;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_secret" ADD CONSTRAINT "user_secret_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "bot_composio_app" ADD CONSTRAINT "bot_composio_app_bot_id_bot_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bot"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "bot_workflow" ADD CONSTRAINT "bot_workflow_bot_id_bot_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bot"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "bot_workflow" ADD CONSTRAINT "bot_workflow_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_secret_user_name_unique" ON "user_secret" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_secret_userId_idx" ON "user_secret" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bot_composio_app_botId_idx" ON "bot_composio_app" USING btree ("bot_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bot_workflow_wf_idx" ON "bot_workflow" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_run_bot_idx" ON "workflow_run" USING btree ("started_by_bot_id","created_at");