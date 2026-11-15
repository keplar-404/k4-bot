-- Memory is now keyed by user, not by eve's hashed scope key. Old rows can't be
-- mapped to a user, so they are dropped (dev test data only).
DELETE FROM "agent_memory";--> statement-breakpoint
ALTER TABLE "agent_memory" DROP COLUMN "key";--> statement-breakpoint
ALTER TABLE "agent_memory" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "agent_memory" ALTER COLUMN "content" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "agent_memory" ADD COLUMN "user_id" text PRIMARY KEY NOT NULL;
