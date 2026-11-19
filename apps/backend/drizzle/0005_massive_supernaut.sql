CREATE TABLE "user_computer" (
	"user_id" text PRIMARY KEY NOT NULL,
	"sandbox_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
