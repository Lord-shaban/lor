-- v0.6 had not yet written an embedding when this migration shipped. Clear a
-- defensive future value before changing dimensions: vectors from another
-- model family are not comparable evidence and pgvector quite correctly
-- refuses to coerce their shape silently.
DROP INDEX "search_documents_embedding_hnsw_idx";--> statement-breakpoint
UPDATE "search_documents"
SET "embedding" = NULL,
    "embedding_model" = NULL,
    "embedded_at" = NULL
WHERE "embedding" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "search_documents"
  ALTER COLUMN "embedding" SET DATA TYPE vector(1024)
  USING "embedding"::vector(1024);--> statement-breakpoint
CREATE INDEX "search_documents_embedding_hnsw_idx"
  ON "search_documents" USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;
