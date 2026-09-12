import { and, eq, exists, gte, lt, notExists, or } from "drizzle-orm";
import {
  actionItems,
  decisions,
  getDb,
  summaries,
  timelineManualMoments,
  transcriptLines,
} from "@lor/db";

/**
 * Delete every derived copy first; a failed cleanup must leave its transcript
 * source available for a later retry rather than orphaning a decision or
 * summary that repeats what somebody said.
 */
export async function sweepTranscript(roomId: string, cutoff: Date) {
  const db = getDb();
  const expired = and(eq(transcriptLines.roomId, roomId), lt(transcriptLines.createdAt, cutoff));
  // A manual moment has no text source of its own. It expires at the same
  // boundary as the meeting record, and disappears immediately once its
  // occurrence no longer has a retained timeline-eligible caption.
  await db.delete(timelineManualMoments).where(and(
    eq(timelineManualMoments.roomId, roomId),
    or(
      lt(timelineManualMoments.createdAt, cutoff),
      notExists(
        db
          .select({ id: transcriptLines.id })
          .from(transcriptLines)
          .where(and(
            eq(transcriptLines.roomId, roomId),
            eq(transcriptLines.occurrenceId, timelineManualMoments.occurrenceId),
            gte(transcriptLines.createdAt, cutoff),
          )),
      ),
    ),
  ));
  await db.delete(actionItems).where(and(
    eq(actionItems.roomId, roomId),
    exists(db.select({ id: transcriptLines.id }).from(transcriptLines).where(and(
      expired,
      // An expired caption may delete only the task derived from that caption.
      // A room can contain years of separate occurrences within the current
      // retention window; treating one expiry as a reason to erase all its
      // current tasks would turn retention into data loss.
      eq(transcriptLines.id, actionItems.sourceLineId),
    ))),
  ));
  await db.delete(decisions).where(and(
    eq(decisions.roomId, roomId),
    exists(db.select({ id: transcriptLines.id }).from(transcriptLines).where(and(
      expired,
      // The same source authority applies to a reviewed decision.
      eq(transcriptLines.id, decisions.sourceLineId),
    ))),
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
