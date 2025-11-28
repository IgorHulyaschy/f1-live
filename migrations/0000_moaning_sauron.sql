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
--> statement-breakpoint
CREATE TABLE "grand_prix" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"year" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lap" (
	"id" varchar PRIMARY KEY NOT NULL,
	"driver_id" varchar NOT NULL,
	"time" text NOT NULL,
	"lap_number" integer NOT NULL,
	"grand_prix_id" varchar NOT NULL
);
