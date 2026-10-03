CREATE TABLE "accounts"."library_add" (
	"entry_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_add_entry_id_user_id_pk" PRIMARY KEY("entry_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "accounts"."library_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"dashboard_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"tags" jsonb NOT NULL,
	"document" jsonb NOT NULL,
	"adds" integer DEFAULT 0 NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts"."library_handle" (
	"user_id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_handle_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "accounts"."library_report" (
	"entry_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_report_entry_id_user_id_pk" PRIMARY KEY("entry_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "accounts"."library_add" ADD CONSTRAINT "library_add_entry_id_library_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "accounts"."library_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts"."library_add" ADD CONSTRAINT "library_add_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "accounts"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts"."library_entry" ADD CONSTRAINT "library_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "accounts"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts"."library_handle" ADD CONSTRAINT "library_handle_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "accounts"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts"."library_report" ADD CONSTRAINT "library_report_entry_id_library_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "accounts"."library_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts"."library_report" ADD CONSTRAINT "library_report_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "accounts"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "library_entry_author_dashboard_idx" ON "accounts"."library_entry" USING btree ("user_id","dashboard_id");--> statement-breakpoint
CREATE INDEX "library_entry_listing_idx" ON "accounts"."library_entry" USING btree ("hidden","adds");