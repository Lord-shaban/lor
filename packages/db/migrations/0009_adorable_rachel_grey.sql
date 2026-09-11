ALTER TABLE "transcript_lines" ADD COLUMN "occurrence_id" uuid;--> statement-breakpoint
ALTER TABLE "transcript_lines" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
-- The composite key must exist before Postgres can accept the composite
-- foreign key below. Drizzle serialises table changes separately, so preserve
-- this dependency explicitly in the reviewed migration.
ALTER TABLE "meeting_occurrences" ADD CONSTRAINT "meeting_occurrences_room_id_id_key" UNIQUE("room_id","id");--> statement-breakpoint
ALTER TABLE "transcript_lines" ADD CONSTRAINT "transcript_lines_room_id_occurrence_id_meeting_occurrences_room_id_id_fk" FOREIGN KEY ("room_id","occurrence_id") REFERENCES "public"."meeting_occurrences"("room_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transcript_lines_room_occurrence_seq_idx" ON "transcript_lines" USING btree ("room_id","occurrence_id","seq");--> statement-breakpoint
ALTER TABLE "transcript_lines" ADD CONSTRAINT "transcript_lines_timeline_timing_check" CHECK ((
        ("transcript_lines"."occurrence_id" is null and "transcript_lines"."duration_ms" is null)
        or (
          "transcript_lines"."occurrence_id" is not null
          and "transcript_lines"."duration_ms" between 250 and 21000
        )
      ));
