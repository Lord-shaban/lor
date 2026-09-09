import { and, eq, exists, lt, or } from "drizzle-orm";
import { decisions, getDb, summaries, transcriptLines } from "@lor/db";

/**
 * Delete every derived copy first; a failed cleanup must leave its transcript
 * source available for a later retry rather than orphaning a decision or
 * summary that repeats what somebody said.
 */
export async function sweepTranscript(roomId: string, cutoff: Date) {
  const db = getDb();
  const expired = and(eq(transcriptLines.roomId, roomId), lt(transcriptLines.createdAt, cutoff));
  await db.delete(decisions).where(and(
    eq(decisions.roomId, roomId),
    exists(db.select({ id: transcriptLines.id }).from(transcriptLines).where(expired)),
  ));
  await db.delete(summaries).where(and(
    eq(summaries.roomId, roomId),
    or(
      lt(summaries.createdAt, cutoff),
      exists(db.select({ id: transcriptLines.id }).from(transcriptLines).where(expired)),
    ),
  ));
  await db.delete(transcriptLines).where(expired);
}
