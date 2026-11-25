CREATE TABLE "user_provider_key" (
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"sealed" text NOT NULL,
	"hint" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_provider_key_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
