CREATE SCHEMA IF NOT EXISTS "extensions";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA "extensions";--> statement-breakpoint
CREATE TYPE "public"."search_document_kind" AS ENUM('transcript', 'decision', 'notes');--> statement-breakpoint
CREATE TABLE "search_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"kind" "search_document_kind" NOT NULL,
	"transcript_line_id" uuid,
	"decision_id" uuid,
	"notes_snapshot_room_id" uuid,
	"occurrence_id" uuid,
	"source_created_at" timestamp with time zone NOT NULL,
	"speaker_name" text,
	"content" text NOT NULL,
	"embedding" extensions.vector(1536),
	"embedding_model" text,
	"embedded_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_documents_source_kind_check" CHECK ((
        ("search_documents"."kind" = 'transcript'
          and "search_documents"."transcript_line_id" is not null
          and "search_documents"."decision_id" is null
          and "search_documents"."notes_snapshot_room_id" is null)
        or ("search_documents"."kind" = 'decision'
          and "search_documents"."transcript_line_id" is null
          and "search_documents"."decision_id" is not null
          and "search_documents"."notes_snapshot_room_id" is null)
        or ("search_documents"."kind" = 'notes'
          and "search_documents"."transcript_line_id" is null
          and "search_documents"."decision_id" is null
          and "search_documents"."notes_snapshot_room_id" = "search_documents"."room_id")
      )),
	CONSTRAINT "search_documents_embedding_state_check" CHECK ((
        ("search_documents"."embedding" is null and "search_documents"."embedding_model" is null and "search_documents"."embedded_at" is null)
        or ("search_documents"."embedding" is not null and "search_documents"."embedding_model" is not null and "search_documents"."embedded_at" is not null)
      )),
	CONSTRAINT "search_documents_nonempty_content_check" CHECK (char_length(btrim("search_documents"."content")) > 0)
);
--> statement-breakpoint
ALTER TABLE "search_documents" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('simple', "content")) STORED;--> statement-breakpoint
ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_room_transcript_line_fk" FOREIGN KEY ("room_id","transcript_line_id") REFERENCES "public"."transcript_lines"("room_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_room_decision_fk" FOREIGN KEY ("room_id","decision_id") REFERENCES "public"."decisions"("room_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_notes_snapshot_fk" FOREIGN KEY ("notes_snapshot_room_id") REFERENCES "public"."canvas_snapshots"("room_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_documents_room_occurred_at_idx" ON "search_documents" USING btree ("room_id","source_created_at");--> statement-breakpoint
CREATE INDEX "search_documents_room_kind_idx" ON "search_documents" USING btree ("room_id","kind");--> statement-breakpoint
CREATE INDEX "search_documents_lexical_idx" ON "search_documents" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "search_documents_embedding_hnsw_idx" ON "search_documents" USING hnsw ("embedding" extensions.vector_cosine_ops) WHERE "embedding" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "search_documents_transcript_line_unique" ON "search_documents" USING btree ("transcript_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "search_documents_decision_unique" ON "search_documents" USING btree ("decision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "search_documents_notes_snapshot_unique" ON "search_documents" USING btree ("notes_snapshot_room_id");--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_room_id_id_key" UNIQUE("room_id","id");
