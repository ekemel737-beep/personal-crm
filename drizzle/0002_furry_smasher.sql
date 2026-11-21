CREATE TYPE "public"."contact_field" AS ENUM('name', 'howWeMet', 'phone', 'email');--> statement-breakpoint
CREATE TABLE "contact_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"field" "contact_field" NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_changes" ADD CONSTRAINT "contact_changes_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_changes_contact_id_idx" ON "contact_changes" USING btree ("contact_id","changed_at");