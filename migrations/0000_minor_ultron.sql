CREATE TABLE "drivers" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"number" text NOT NULL,
	"team_id" varchar NOT NULL,
	"avatar_url" text
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"logo_url" text
);
