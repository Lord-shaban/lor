import { and, asc, eq, gte, isNull, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { actionItems, getDb, meetingOccurrences, transcriptLines } from "@lor/db";
import { findRoomAccess } from "@/lib/room-access";
import { keptSince, retentionDays } from "@/lib/stt/retention";
import { sweepTranscript } from "@/lib/transcript-retention";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound() {
  // The occurrence is room-scoped server metadata. Do not turn an invalid,
  // old, or other-room occurrence id into an oracle for recurring meetings.
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

/**
 * Return only durable work from before the active server-defined occurrence.
 *
 * This endpoint deliberately has no browser timestamp, user identity, or
 * occurrence-creation path. The token route is the sole writer of meeting
 * boundaries, after it has asked LiveKit whether the room is empty.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/action-items/carry-over">,
) {
  const { code: rawCode } = await params;
  const room = await findRoomAccess(rawCode);
  if (!room) return notFound();

  const occurrenceId = new URL(request.url).searchParams.get("meeting");
  if (!occurrenceId || !UUID.test(occurrenceId)) return notFound();

  const db = getDb();
  const [occurrence] = await db
    .select({ startedAt: meetingOccurrences.startedAt })
    .from(meetingOccurrences)
    .where(and(
      eq(meetingOccurrences.id, occurrenceId),
      eq(meetingOccurrences.roomId, room.id),
      isNull(meetingOccurrences.endedAt),
    ))
    .limit(1);
  if (!occurrence) return notFound();

  const days = retentionDays(process.env);
  const cutoff = keptSince(new Date(), days);
  await sweepTranscript(room.id, cutoff);

  // A current-meeting task has an opened_at at or after this occurrence's
  // server timestamp. Proposals and completed items are excluded in SQL, not
  // hidden after the fact, so this endpoint never becomes a full task inbox.
  const records = await db
    .select({ id: actionItems.id })
    .from(actionItems)
    .innerJoin(transcriptLines, eq(actionItems.sourceLineId, transcriptLines.id))
    .where(and(
      eq(actionItems.roomId, room.id),
      eq(actionItems.status, "open"),
      lt(actionItems.openedAt, occurrence.startedAt),
      gte(transcriptLines.createdAt, cutoff),
    ))
    .orderBy(asc(actionItems.openedAt));

  return NextResponse.json(
    { count: records.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
