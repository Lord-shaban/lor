CREATE TABLE "timeline_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"title" text NOT NULL,
	"source_start_line_id" uuid NOT NULL,
	"source_start_seq" integer NOT NULL,
	"source_start_at" timestamp with time zone NOT NULL,
	"source_end_line_id" uuid NOT NULL,
	"source_end_seq" integer NOT NULL,
	"source_end_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "timeline_chapters_title_check" CHECK (char_length(btrim("timeline_chapters"."title")) between 1 and 200),
	CONSTRAINT "timeline_chapters_source_range_check" CHECK ("timeline_chapters"."source_start_seq" <= "timeline_chapters"."source_end_seq")
);
--> statement-breakpoint
CREATE TABLE "timeline_generated_moments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"source_line_id" uuid NOT NULL,
	"source_seq" integer NOT NULL,
	"source_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- The following source FKs prove that generated navigation belongs to the
-- same occurrence as its retained evidence, so this key must exist first.
ALTER TABLE "transcript_lines" ADD CONSTRAINT "transcript_lines_room_occurrence_id_id_key" UNIQUE("room_id","occurrence_id","id");--> statement-breakpoint
ALTER TABLE "timeline_chapters" ADD CONSTRAINT "timeline_chapters_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_chapters" ADD CONSTRAINT "timeline_chapters_room_id_occurrence_id_meeting_occurrences_room_id_id_fk" FOREIGN KEY ("room_id","occurrence_id") REFERENCES "public"."meeting_occurrences"("room_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_chapters" ADD CONSTRAINT "timeline_chapters_room_id_occurrence_id_source_start_line_id_transcript_lines_room_id_occurrence_id_id_fk" FOREIGN KEY ("room_id","occurrence_id","source_start_line_id") REFERENCES "public"."transcript_lines"("room_id","occurrence_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_chapters" ADD CONSTRAINT "timeline_chapters_room_id_occurrence_id_source_end_line_id_transcript_lines_room_id_occurrence_id_id_fk" FOREIGN KEY ("room_id","occurrence_id","source_end_line_id") REFERENCES "public"."transcript_lines"("room_id","occurrence_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_generated_moments" ADD CONSTRAINT "timeline_generated_moments_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_generated_moments" ADD CONSTRAINT "timeline_generated_moments_room_id_occurrence_id_meeting_occurrences_room_id_id_fk" FOREIGN KEY ("room_id","occurrence_id") REFERENCES "public"."meeting_occurrences"("room_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_generated_moments" ADD CONSTRAINT "timeline_generated_moments_room_id_occurrence_id_source_line_id_transcript_lines_room_id_occurrence_id_id_fk" FOREIGN KEY ("room_id","occurrence_id","source_line_id") REFERENCES "public"."transcript_lines"("room_id","occurrence_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timeline_chapters_room_occurrence_source_start_idx" ON "timeline_chapters" USING btree ("room_id","occurrence_id","source_start_seq","id");--> statement-breakpoint
CREATE UNIQUE INDEX "timeline_chapters_room_occurrence_source_range_unique" ON "timeline_chapters" USING btree ("room_id","occurrence_id","source_start_seq","source_end_seq");--> statement-breakpoint
CREATE INDEX "timeline_generated_moments_room_occurrence_source_idx" ON "timeline_generated_moments" USING btree ("room_id","occurrence_id","source_seq","id");--> statement-breakpoint
CREATE UNIQUE INDEX "timeline_generated_moments_room_occurrence_source_unique" ON "timeline_generated_moments" USING btree ("room_id","occurrence_id","source_line_id");--> statement-breakpoint
-- Generated navigation records retain meeting context and must not become
-- directly readable through Supabase's public Data API.
ALTER TABLE "timeline_chapters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "timeline_generated_moments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "timeline_chapters", "timeline_generated_moments" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "timeline_chapters", "timeline_generated_moments" FROM authenticated;
  END IF;
END
$$;
