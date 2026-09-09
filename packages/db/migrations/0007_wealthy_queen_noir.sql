CREATE TYPE "public"."action_item_origin" AS ENUM('manual', 'llm');--> statement-breakpoint
CREATE TYPE "public"."action_item_status" AS ENUM('proposed', 'open', 'completed');--> statement-breakpoint
CREATE TABLE "action_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"source_line_id" uuid NOT NULL,
	"source_seq" integer NOT NULL,
	"source_speaker" text NOT NULL,
	"source_quote" text NOT NULL,
	"source_created_at" timestamp with time zone NOT NULL,
	"assignee_identity" text,
	"assignee_name" text,
	"due_on" date,
	"status" "action_item_status" DEFAULT 'proposed' NOT NULL,
	"origin" "action_item_origin" DEFAULT 'manual' NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_items_nonempty_text_check" CHECK (char_length(btrim("action_items"."text")) > 0),
	CONSTRAINT "action_items_assignee_pair_check" CHECK ((
        ("action_items"."assignee_identity" is null and "action_items"."assignee_name" is null)
        or (
          "action_items"."assignee_identity" is not null
          and "action_items"."assignee_name" is not null
          and char_length(btrim("action_items"."assignee_identity")) > 0
          and char_length(btrim("action_items"."assignee_name")) > 0
        )
      )),
	CONSTRAINT "action_items_lifecycle_state_check" CHECK ((
        "action_items"."status" = 'proposed'
        and "action_items"."opened_at" is null
        and "action_items"."completed_at" is null
      ) or (
        "action_items"."status" = 'open'
        and "action_items"."assignee_identity" is not null
        and "action_items"."assignee_name" is not null
        and "action_items"."due_on" is not null
        and "action_items"."opened_at" is not null
        and "action_items"."completed_at" is null
      ) or (
        "action_items"."status" = 'completed'
        and "action_items"."assignee_identity" is not null
        and "action_items"."assignee_name" is not null
        and "action_items"."due_on" is not null
        and "action_items"."opened_at" is not null
        and "action_items"."completed_at" is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "meeting_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "meeting_occurrences_end_after_start_check" CHECK ("meeting_occurrences"."ended_at" is null or "meeting_occurrences"."ended_at" >= "meeting_occurrences"."started_at")
);
--> statement-breakpoint
-- The following composite foreign key needs this uniqueness before it is
-- created; a globally unique transcript id alone cannot prove room scope.
ALTER TABLE "transcript_lines" ADD CONSTRAINT "transcript_lines_room_id_id_key" UNIQUE("room_id","id");--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_room_source_line_transcript_lines_fk" FOREIGN KEY ("room_id","source_line_id") REFERENCES "public"."transcript_lines"("room_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_occurrences" ADD CONSTRAINT "meeting_occurrences_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_items_room_source_seq_idx" ON "action_items" USING btree ("room_id","source_seq");--> statement-breakpoint
CREATE INDEX "action_items_source_line_id_idx" ON "action_items" USING btree ("source_line_id");--> statement-breakpoint
CREATE INDEX "action_items_room_opened_at_idx" ON "action_items" USING btree ("room_id","opened_at") WHERE "action_items"."status" = 'open';--> statement-breakpoint
CREATE UNIQUE INDEX "action_items_room_source_text_unique" ON "action_items" USING btree ("room_id","source_line_id","text");--> statement-breakpoint
CREATE INDEX "meeting_occurrences_room_started_at_idx" ON "meeting_occurrences" USING btree ("room_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_occurrences_room_active_unique" ON "meeting_occurrences" USING btree ("room_id") WHERE "meeting_occurrences"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "transcript_lines_room_speaker_created_at_idx" ON "transcript_lines" USING btree ("room_id","speaker_identity","created_at");--> statement-breakpoint
-- Source evidence and the assignee display name are never accepted from a
-- browser or model. The trigger reads the one retained transcript row that the
-- composite FK has already tied to this room, then overwrites both snapshots.
CREATE OR REPLACE FUNCTION "public"."action_items_before_write"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  source "public"."transcript_lines"%ROWTYPE;
  assignee_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'proposed'
      OR NEW."opened_at" IS NOT NULL
      OR NEW."completed_at" IS NOT NULL THEN
      RAISE EXCEPTION 'action items must start as proposed'
        USING ERRCODE = '23514';
    END IF;

    SELECT * INTO source
    FROM "public"."transcript_lines"
    WHERE "room_id" = NEW."room_id"
      AND "id" = NEW."source_line_id";

    IF NOT FOUND THEN
      RAISE EXCEPTION 'action item source must belong to its room'
        USING ERRCODE = '23503';
    END IF;

    NEW."source_seq" := source."seq";
    NEW."source_speaker" := source."speaker_name";
    NEW."source_quote" := source."text";
    NEW."source_created_at" := source."created_at";
  ELSE
    IF NEW."room_id" IS DISTINCT FROM OLD."room_id"
      OR NEW."source_line_id" IS DISTINCT FROM OLD."source_line_id"
      OR NEW."source_seq" IS DISTINCT FROM OLD."source_seq"
      OR NEW."source_speaker" IS DISTINCT FROM OLD."source_speaker"
      OR NEW."source_quote" IS DISTINCT FROM OLD."source_quote"
      OR NEW."source_created_at" IS DISTINCT FROM OLD."source_created_at"
      OR NEW."origin" IS DISTINCT FROM OLD."origin" THEN
      RAISE EXCEPTION 'action item source evidence and provenance are immutable'
        USING ERRCODE = '23514';
    END IF;

    IF OLD."status" = 'proposed' AND NEW."status" NOT IN ('proposed', 'open') THEN
      RAISE EXCEPTION 'only proposed action items may become open'
        USING ERRCODE = '23514';
    ELSIF OLD."status" = 'open' AND NEW."status" NOT IN ('open', 'completed') THEN
      RAISE EXCEPTION 'only open action items may become completed'
        USING ERRCODE = '23514';
    ELSIF OLD."status" = 'completed' AND NEW."status" <> 'completed' THEN
      RAISE EXCEPTION 'completed action items cannot change lifecycle'
        USING ERRCODE = '23514';
    END IF;

    IF OLD."status" = 'proposed' AND NEW."status" = 'open' THEN
      NEW."opened_at" := clock_timestamp();
    ELSIF NEW."opened_at" IS DISTINCT FROM OLD."opened_at" THEN
      RAISE EXCEPTION 'opened_at is set only when an action item opens'
        USING ERRCODE = '23514';
    END IF;

    IF OLD."status" = 'open' AND NEW."status" = 'completed' THEN
      NEW."completed_at" := clock_timestamp();
    ELSIF NEW."completed_at" IS DISTINCT FROM OLD."completed_at" THEN
      RAISE EXCEPTION 'completed_at is set only when an action item completes'
        USING ERRCODE = '23514';
    END IF;

    IF OLD."status" = 'completed' AND (
      NEW."text" IS DISTINCT FROM OLD."text"
      OR NEW."assignee_identity" IS DISTINCT FROM OLD."assignee_identity"
      OR NEW."assignee_name" IS DISTINCT FROM OLD."assignee_name"
      OR NEW."due_on" IS DISTINCT FROM OLD."due_on"
    ) THEN
      RAISE EXCEPTION 'completed action items are immutable'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."assignee_identity" IS NULL THEN
    NEW."assignee_name" := NULL;
  ELSIF TG_OP = 'UPDATE'
    AND NEW."assignee_identity" IS NOT DISTINCT FROM OLD."assignee_identity" THEN
    -- The snapshot is stable after assignment; ignore a later browser/model
    -- attempt to rewrite the display name.
    NEW."assignee_name" := OLD."assignee_name";
  ELSE
    SELECT "speaker_name" INTO assignee_name
    FROM "public"."transcript_lines"
    WHERE "room_id" = NEW."room_id"
      AND "speaker_identity" = NEW."assignee_identity"
    ORDER BY "created_at" DESC, "id" DESC
    LIMIT 1;

    IF NOT FOUND OR char_length(btrim(assignee_name)) = 0 THEN
      RAISE EXCEPTION 'action item assignee must be a retained room participant'
        USING ERRCODE = '23514';
    END IF;

    NEW."assignee_name" := assignee_name;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW."updated_at" := clock_timestamp();
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "action_items_before_write"
BEFORE INSERT OR UPDATE ON "public"."action_items"
FOR EACH ROW EXECUTE FUNCTION "public"."action_items_before_write"();--> statement-breakpoint
-- Durable meeting content remains server-only even though Supabase exposes the
-- public schema through PostgREST. LOR. has no accounts or browser database
-- client, so no policy is deliberately granted.
ALTER TABLE "action_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meeting_occurrences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transcript_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "summaries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "action_items", "meeting_occurrences", "transcript_lines", "summaries" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "action_items", "meeting_occurrences", "transcript_lines", "summaries" FROM authenticated;
  END IF;
END
$$;
