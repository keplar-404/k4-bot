-- Servers added before Composio hosted them can't be moved over: users add them again.
DELETE FROM "user_mcp";--> statement-breakpoint
ALTER TABLE "user_mcp" DROP COLUMN IF EXISTS "description";--> statement-breakpoint
ALTER TABLE "user_mcp" DROP COLUMN IF EXISTS "logo";--> statement-breakpoint
ALTER TABLE "user_mcp" DROP COLUMN IF EXISTS "header";--> statement-breakpoint
ALTER TABLE "user_mcp" DROP COLUMN IF EXISTS "key";--> statement-breakpoint
-- Left over from an OAuth version that never shipped (development databases only).
ALTER TABLE "user_mcp" DROP COLUMN IF EXISTS "oauth";--> statement-breakpoint
DROP TABLE IF EXISTS "mcp_oauth_client";