ALTER TABLE "user_mcp" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user_mcp" ADD COLUMN "auth" text NOT NULL;--> statement-breakpoint
CREATE INDEX "user_mcp_slug_idx" ON "user_mcp" USING btree ("slug");