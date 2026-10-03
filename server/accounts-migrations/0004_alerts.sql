CREATE TABLE "accounts"."alert_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts"."push_subscription" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts"."alert_settings" ADD CONSTRAINT "alert_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "accounts"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts"."push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "accounts"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_subscription_user_id_idx" ON "accounts"."push_subscription" USING btree ("user_id");