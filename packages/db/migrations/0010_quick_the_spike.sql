CREATE TABLE "timeline_manual_moments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "timeline_manual_moments_label_check" CHECK ("timeline_manual_moments"."label" is null or (
        char_length(btrim("timeline_manual_moments"."label")) between 1 and 200
      ))
);
--> statement-breakpoint
ALTER TABLE "timeline_manual_moments" ADD CONSTRAINT "timeline_manual_moments_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_manual_moments" ADD CONSTRAINT "timeline_manual_moments_room_id_occurrence_id_meeting_occurrences_room_id_id_fk" FOREIGN KEY ("room_id","occurrence_id") REFERENCES "public"."meeting_occurrences"("room_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timeline_manual_moments_room_occurrence_created_at_idx" ON "timeline_manual_moments" USING btree ("room_id","occurrence_id","created_at","id");--> statement-breakpoint
CREATE INDEX "timeline_manual_moments_room_created_at_idx" ON "timeline_manual_moments" USING btree ("room_id","created_at");--> statement-breakpoint
CREATE INDEX "transcript_lines_room_occurrence_created_at_idx" ON "transcript_lines" USING btree ("room_id","occurrence_id","created_at");--> statement-breakpoint
-- The browser never uses Supabase/PostgREST directly. Timeline records stay
-- server-only like the retained transcript they accompany.
ALTER TABLE "timeline_manual_moments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "timeline_manual_moments" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "timeline_manual_moments" FROM authenticated;
  END IF;
END
$$;
