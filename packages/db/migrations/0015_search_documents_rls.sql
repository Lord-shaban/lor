-- Search documents contain retained meeting evidence. They are reached only
-- through the server, which connects as the table owner; a public Data API
-- role must never be able to read them directly.
ALTER TABLE "search_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "search_documents" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "search_documents" FROM authenticated;
  END IF;
END
$$;
