-- Reopening is a host-reviewed status transition, not a new task or a rewrite
-- of its source evidence. Keep the original opened_at, clear only the terminal
-- timestamp, and leave the existing immutable-text/owner/due guard in force.
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
    ELSIF OLD."status" = 'completed' AND NEW."status" NOT IN ('completed', 'open') THEN
      RAISE EXCEPTION 'completed action items may only reopen'
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
    ELSIF OLD."status" = 'completed' AND NEW."status" = 'open' THEN
      NEW."completed_at" := NULL;
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
$$;
