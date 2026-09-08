import { and, eq, exists, lt, or } from "drizzle-orm";
import { getDb, summaries, transcriptLines } from "@lor/db";

/** Delete derived copies first; a failed cleanup must not orphan a summary. */
export async function sweepTranscript(roomId: string, cutoff: Date) {
  const db = getDb();
  const expired = and(eq(transcriptLines.roomId, roomId), lt(transcriptLines.createdAt, cutoff));
  await db.delete(summaries).where(and(
    eq(summaries.roomId, roomId),
    or(
      lt(summaries.createdAt, cutoff),
      exists(db.select({ id: transcriptLines.id }).from(transcriptLines).where(expired)),
    ),
  ));
  await db.delete(transcriptLines).where(expired);
}
