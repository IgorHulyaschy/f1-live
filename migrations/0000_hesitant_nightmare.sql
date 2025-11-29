CREATE TABLE "sessions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"country" varchar NOT NULL,
	"type" varchar NOT NULL,
	"date" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lap" (
	"id" varchar PRIMARY KEY NOT NULL,
	"driver_number" text NOT NULL,
	"lap_number" integer NOT NULL,
	"sector1_time" integer,
	"sector2_time" integer,
	"sector3_time" integer,
	"time" integer NOT NULL,
	"session_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"number" text NOT NULL,
	"team" varchar NOT NULL,
	"avatar_url" text,
	CONSTRAINT "drivers_number_unique" UNIQUE("number")
);
