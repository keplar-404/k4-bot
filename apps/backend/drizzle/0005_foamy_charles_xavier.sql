CREATE TABLE "bot_mcp_server" (
	"bot_id" text NOT NULL,
	"user_mcp_server_id" text NOT NULL,
	CONSTRAINT "bot_mcp_server_bot_id_user_mcp_server_id_pk" PRIMARY KEY("bot_id","user_mcp_server_id")
);
--> statement-breakpoint
CREATE TABLE "bot_skill" (
	"bot_id" text NOT NULL,
	"user_skill_id" text NOT NULL,
	CONSTRAINT "bot_skill_bot_id_user_skill_id_pk" PRIMARY KEY("bot_id","user_skill_id")
);
--> statement-breakpoint
CREATE TABLE "user_mcp_server" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"server_id" text NOT NULL,
	"secrets" text,
	"secret_hint" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_skill" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"hash" text,
	"storage_key" text NOT NULL,
	"file_count" integer NOT NULL,
	"size" integer NOT NULL,
	"installed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bot_mcp_server" ADD CONSTRAINT "bot_mcp_server_bot_id_bot_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_mcp_server" ADD CONSTRAINT "bot_mcp_server_user_mcp_server_id_user_mcp_server_id_fk" FOREIGN KEY ("user_mcp_server_id") REFERENCES "public"."user_mcp_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_skill" ADD CONSTRAINT "bot_skill_bot_id_bot_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_skill" ADD CONSTRAINT "bot_skill_user_skill_id_user_skill_id_fk" FOREIGN KEY ("user_skill_id") REFERENCES "public"."user_skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_mcp_server" ADD CONSTRAINT "user_mcp_server_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skill" ADD CONSTRAINT "user_skill_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bot_mcp_server_userMcpServerId_idx" ON "bot_mcp_server" USING btree ("user_mcp_server_id");--> statement-breakpoint
CREATE INDEX "bot_skill_userSkillId_idx" ON "bot_skill" USING btree ("user_skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_mcp_server_user_server_unique" ON "user_mcp_server" USING btree ("user_id","server_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_skill_user_skill_unique" ON "user_skill" USING btree ("user_id","skill_id");