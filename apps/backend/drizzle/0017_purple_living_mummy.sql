CREATE TABLE "composio_event" (
	"id" text PRIMARY KEY NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow" ADD COLUMN "composio_trigger_id" text;--> statement-breakpoint
CREATE INDEX "workflow_composio_trigger_idx" ON "workflow" USING btree ("composio_trigger_id");