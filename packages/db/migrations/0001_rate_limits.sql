CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Same reasoning as the first migration: LOR. reaches Postgres directly as the
-- table owner, which bypasses RLS, while a managed Postgres would otherwise
-- publish this table through a browser-authenticated REST API. No policy is
-- granted, deliberately.
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;
