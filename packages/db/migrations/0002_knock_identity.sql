ALTER TABLE "knocks" ADD COLUMN "participant_identity" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "knocks_room_identity_key" ON "knocks" USING btree ("room_id","participant_identity");