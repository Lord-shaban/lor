CREATE TYPE "public"."decision_origin" AS ENUM('manual', 'llm');--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "origin" "decision_origin" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "decisions_room_source_line_unique" ON "decisions" USING btree ("room_id","source_line_id");