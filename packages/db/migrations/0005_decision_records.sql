CREATE TYPE "public"."decision_status" AS ENUM('proposed', 'confirmed');--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"source_line_id" uuid NOT NULL,
	"source_seq" integer NOT NULL,
	"source_speaker" text NOT NULL,
	"source_quote" text NOT NULL,
	"source_created_at" timestamp with time zone NOT NULL,
	"status" "decision_status" DEFAULT 'proposed' NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_source_line_id_transcript_lines_id_fk" FOREIGN KEY ("source_line_id") REFERENCES "public"."transcript_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- A confirmation is a state transition, not just a label. This prevents a
-- partial write from producing a "confirmed" decision with no confirmation
-- time, or a proposal that looks historically confirmed.
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_confirmation_state_check"
CHECK (
  ("status" = 'proposed' AND "confirmed_at" IS NULL)
  OR ("status" = 'confirmed' AND "confirmed_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX "decisions_room_source_seq_idx" ON "decisions" USING btree ("room_id","source_seq");--> statement-breakpoint
CREATE INDEX "decisions_source_line_id_idx" ON "decisions" USING btree ("source_line_id");--> statement-breakpoint
-- Decisions contain retained meeting content. The browser may reach them only
-- through the application route, which applies room and host-cookie checks.
ALTER TABLE "decisions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- These Supabase roles are deliberately absent in self-hosted Postgres and CI.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "decisions" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "decisions" FROM authenticated;
  END IF;
END
$$;
