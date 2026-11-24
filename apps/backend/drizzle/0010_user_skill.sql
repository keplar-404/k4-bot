CREATE TABLE "user_skill" (
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"prefix" text NOT NULL,
	"files" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_skill_user_id_name_pk" PRIMARY KEY("user_id","name")
);
