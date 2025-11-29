CREATE TABLE "logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic" varchar NOT NULL,
	"event_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
