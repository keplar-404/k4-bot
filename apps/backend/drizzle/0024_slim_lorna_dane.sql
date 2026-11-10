ALTER TABLE "user_secret" ADD COLUMN IF NOT EXISTS "app" text;--> statement-breakpoint
ALTER TABLE "composio_toolkit" ADD COLUMN IF NOT EXISTS "auth_schemes" jsonb DEFAULT '[]'::jsonb NOT NULL;