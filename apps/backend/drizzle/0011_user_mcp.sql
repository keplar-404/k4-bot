CREATE TABLE "user_mcp" (
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"description" text NOT NULL,
	"logo" text,
	"header" text,
	"key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_mcp_user_id_name_pk" PRIMARY KEY("user_id","name")
);
