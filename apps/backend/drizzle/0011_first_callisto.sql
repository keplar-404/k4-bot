CREATE TABLE "web_usage" (
	"scope" text NOT NULL,
	"day" text NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "web_usage_scope_day_pk" PRIMARY KEY("scope","day")
);
