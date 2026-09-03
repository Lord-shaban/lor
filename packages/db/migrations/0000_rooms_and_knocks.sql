CREATE TYPE "public"."knock_status" AS ENUM('pending', 'admitted', 'denied');--> statement-breakpoint
CREATE TABLE "knocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"claim_secret_hash" text NOT NULL,
	"status" "knock_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"livekit_room" text NOT NULL,
	"host_secret_hash" text NOT NULL,
	"locale" text DEFAULT 'ar' NOT NULL,
	"waiting_room_enabled" boolean DEFAULT false NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knocks" ADD CONSTRAINT "knocks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knocks_room_status_idx" ON "knocks" USING btree ("room_id","status");--> statement-breakpoint
CREATE INDEX "knocks_created_at_idx" ON "knocks" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_code_key" ON "rooms" USING btree ("code");--> statement-breakpoint
CREATE INDEX "rooms_last_seen_at_idx" ON "rooms" USING btree ("last_seen_at");--> statement-breakpoint
-- Row level security, enabled with no policies at all.
--
-- LOR. talks to Postgres directly as the table owner, and an owner bypasses RLS,
-- so the application is unaffected. What this shuts is the other door: a managed
-- Postgres such as Supabase publishes every table in `public` through a REST API
-- authenticated by a key that ships in the browser. Without this, anyone holding
-- that public key could read `host_secret_hash` and forge admission to any room.
--
-- No policy is granted deliberately. Nothing should reach these tables except
-- our own server, and a policy would be a way in.
ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "knocks" ENABLE ROW LEVEL SECURITY;
