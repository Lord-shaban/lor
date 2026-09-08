CREATE TABLE "canvas_snapshots" (
	"room_id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"document" "bytea" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canvas_snapshots" ADD CONSTRAINT "canvas_snapshots_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Snapshots contain whatever a room put on its board or in its notes. The
-- browser reaches them only through the application route; neither Supabase
-- Data API client role gets a table privilege or an RLS policy.
ALTER TABLE "canvas_snapshots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- `anon` and `authenticated` exist on Supabase but deliberately do not exist
-- in the plain Postgres used for self-hosting and CI.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "canvas_snapshots" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "canvas_snapshots" FROM authenticated;
  END IF;
END
$$;
