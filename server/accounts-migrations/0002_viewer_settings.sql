CREATE TABLE "accounts"."viewer_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts"."viewer_settings" ADD CONSTRAINT "viewer_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "accounts"."user"("id") ON DELETE cascade ON UPDATE no action;