import { NextResponse } from "next/server";
import { and, asc, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import {
  actionItems,
  decisions,
  getDb,
  meetingOccurrences,
  rooms,
  transcriptLines,
} from "@lor/db";
import {
  MAX_MEMORY_ACTION_ITEMS,
  MAX_MEMORY_DECISIONS,
  MAX_MEMORY_REPEATED_SPEAKERS,
  repeatedSpeakerLabel,
} from "@/lib/meeting-memory";
import { findRoomAccess } from "@/lib/room-access";
import { readGlossary } from "@/lib/stt/glossary";
import { keptSince, retentionDays } from "@/lib/stt/retention";
import { sweepTranscript } from "@/lib/transcript-retention";

function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

/**
 * Meet only at a server-confirmed boundary. A null occurrence id is legacy
 * retained text; it has no honest recurrence boundary, so it is deliberately
 * absent from Memory rather than being guessed into a past meeting.
 */
function endedOccurrenceEvidence(roomId: string, cutoff: Date) {
  return and(
    eq(transcriptLines.roomId, roomId),
    eq(transcriptLines.roomId, meetingOccurrences.roomId),
    eq(transcriptLines.occurrenceId, meetingOccurrences.id),
    isNotNull(meetingOccurrences.endedAt),
    gte(transcriptLines.createdAt, cutoff),
  );
}

/**
 * Read a compact, factual room memory from retained evidence.
 *
 * The response purposefully does not accept an occurrence, identity, date, or
 * search query from the browser. It can only describe prior confirmed
 * occurrences of the room the caller already accessed.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/rooms/[code]/memory">,
) {
  const { code: rawCode } = await params;
  const room = await findRoomAccess(rawCode);
  if (!room) return notFound();

  const days = retentionDays(process.env);
  const cutoff = keptSince(new Date(), days);
  await sweepTranscript(room.id, cutoff);

  const db = getDb();
  const evidence = endedOccurrenceEvidence(room.id, cutoff);
  const occurrenceCount = sql<number>`count(distinct ${transcriptLines.occurrenceId})`;
  const lastSpokeAt = sql<Date>`max(${transcriptLines.createdAt})`;

  const [lastOccurrenceRows, decisionRows, actionItemRows, speakerRows, settingsRows] = await Promise.all([
    db
      .select({
        id: meetingOccurrences.id,
        startedAt: meetingOccurrences.startedAt,
        endedAt: meetingOccurrences.endedAt,
      })
      .from(meetingOccurrences)
      .innerJoin(transcriptLines, and(
        eq(transcriptLines.roomId, meetingOccurrences.roomId),
        eq(transcriptLines.occurrenceId, meetingOccurrences.id),
      ))
      .where(evidence)
      .orderBy(desc(meetingOccurrences.endedAt), desc(meetingOccurrences.id))
      .limit(1),
    db
      .select({
        id: decisions.id,
        text: decisions.text,
        confirmedAt: decisions.confirmedAt,
        seq: transcriptLines.seq,
        speaker: transcriptLines.speakerName,
        quote: transcriptLines.text,
        sourceAt: transcriptLines.createdAt,
      })
      .from(decisions)
      .innerJoin(transcriptLines, eq(decisions.sourceLineId, transcriptLines.id))
      .innerJoin(meetingOccurrences, and(
        eq(transcriptLines.roomId, meetingOccurrences.roomId),
        eq(transcriptLines.occurrenceId, meetingOccurrences.id),
      ))
      .where(and(evidence, eq(decisions.roomId, room.id), eq(decisions.status, "confirmed")))
      .orderBy(
        desc(meetingOccurrences.endedAt),
        desc(transcriptLines.seq),
        desc(decisions.confirmedAt),
        desc(decisions.id),
      )
      .limit(MAX_MEMORY_DECISIONS),
    db
      .select({
        id: actionItems.id,
        text: actionItems.text,
        assigneeName: actionItems.assigneeName,
        dueOn: actionItems.dueOn,
        openedAt: actionItems.openedAt,
        seq: transcriptLines.seq,
        speaker: transcriptLines.speakerName,
        quote: transcriptLines.text,
        sourceAt: transcriptLines.createdAt,
      })
      .from(actionItems)
      .innerJoin(transcriptLines, eq(actionItems.sourceLineId, transcriptLines.id))
      .innerJoin(meetingOccurrences, and(
        eq(transcriptLines.roomId, meetingOccurrences.roomId),
        eq(transcriptLines.occurrenceId, meetingOccurrences.id),
      ))
      .where(and(evidence, eq(actionItems.roomId, room.id), eq(actionItems.status, "open")))
      .orderBy(asc(actionItems.dueOn), asc(actionItems.openedAt), asc(actionItems.id))
      .limit(MAX_MEMORY_ACTION_ITEMS),
    db
      .select({
        name: transcriptLines.speakerName,
        occurrenceCount,
        lastSpokeAt,
      })
      .from(transcriptLines)
      .innerJoin(meetingOccurrences, and(
        eq(transcriptLines.roomId, meetingOccurrences.roomId),
        eq(transcriptLines.occurrenceId, meetingOccurrences.id),
      ))
      .where(evidence)
      .groupBy(transcriptLines.speakerName)
      .having(sql`${occurrenceCount} >= 2`)
      .orderBy(desc(occurrenceCount), desc(lastSpokeAt), asc(transcriptLines.speakerName))
      .limit(MAX_MEMORY_REPEATED_SPEAKERS),
    db
      .select({ settings: rooms.settings })
      .from(rooms)
      .where(eq(rooms.id, room.id))
      .limit(1),
  ]);

  const [lastOccurrence] = lastOccurrenceRows;
  if (!lastOccurrence) {
    return NextResponse.json(
      {
        state: "empty",
        reason: "no_retained_history",
        retentionDays: days,
        lastOccurrence: null,
        decisions: [],
        actionItems: [],
        glossary: [],
        repeatedSpeakers: [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      state: "available",
      retentionDays: days,
      lastOccurrence: {
        id: lastOccurrence.id,
        startedAt: lastOccurrence.startedAt,
        // `endedOccurrenceEvidence` excludes a null end timestamp. The
        // assertion keeps the route's public contract precise in TypeScript.
        endedAt: lastOccurrence.endedAt!,
      },
      decisions: decisionRows.map((decision) => ({
        id: decision.id,
        text: decision.text,
        confirmedAt: decision.confirmedAt,
        source: {
          seq: decision.seq,
          speaker: decision.speaker,
          quote: decision.quote,
          at: decision.sourceAt,
        },
      })),
      actionItems: actionItemRows.map((item) => ({
        id: item.id,
        text: item.text,
        assigneeName: item.assigneeName,
        dueOn: item.dueOn,
        openedAt: item.openedAt,
        source: {
          seq: item.seq,
          speaker: item.speaker,
          quote: item.quote,
          at: item.sourceAt,
        },
      })),
      glossary: readGlossary(settingsRows[0]?.settings),
      repeatedSpeakers: speakerRows.map((speaker) => ({
        name: speaker.name,
        occurrenceCount: Number(speaker.occurrenceCount),
        lastSpokeAt: speaker.lastSpokeAt,
        // This stays a display clarification, never a durable person id.
        kind: repeatedSpeakerLabel(Number(speaker.occurrenceCount)),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
