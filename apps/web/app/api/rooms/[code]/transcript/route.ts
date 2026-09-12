import { NextResponse } from "next/server";
import { and, asc, eq, gte, isNull, sql } from "drizzle-orm";
import {
  actionItems,
  decisions,
  getDb,
  meetingOccurrences,
  rooms,
  summaries,
  timelineManualMoments,
  transcriptLines,
} from "@lor/db";
import { normalizeRoomCode } from "@/lib/room-code";
import { keptSince, retentionDays } from "@/lib/stt/retention";
import { MAX_CAPTION_LENGTH } from "@/lib/data-channel";
import { exportTranscript } from "@/lib/transcript-export";
import { sweepTranscript } from "@/lib/transcript-retention";
import { readTranscriptTimingRequest } from "@/lib/transcript-timing";

/**
 * What the meeting said, once it agreed to keep it.
 *
 * The first route in this project that stores what people say, so the rules it
 * enforces are not conveniences:
 *
 * - **Only settled lines reach here.** The client sends nothing from the fast
 *   pass; a guess is a preview and a preview does not become a record.
 * - **Rows older than the retention period are never returned and are removed
 *   on the way past.** A period enforced only by a job that might not be
 *   running is a period nobody can rely on, so every read sweeps.
 * - **Deleting takes derived records too.** Otherwise deletion leaves behind a
 *   summary or a decision that repeats exactly what was deleted.
 */

/** One line is one utterance, which `vad.ts` already bounds. */
const MAX_LINES_PER_ROOM = 5_000;

async function findRoom(rawCode: string) {
  const code = normalizeRoomCode(rawCode);
  if (!code) return null;

  const db = getDb();
  const [room] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  return room ?? null;
}

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/transcript"> ,
) {
  const { code } = await params;
  const room = await findRoom(code);
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const db = getDb();
  const days = retentionDays(process.env);
  await sweepTranscript(room.id, keptSince(new Date(), days));
  const lines = await db
    .select({
      speaker: transcriptLines.speakerName,
      text: transcriptLines.text,
      seq: transcriptLines.seq,
      at: transcriptLines.createdAt,
      occurrenceId: transcriptLines.occurrenceId,
      durationMs: transcriptLines.durationMs,
    })
    .from(transcriptLines)
    .where(
      and(
        eq(transcriptLines.roomId, room.id),
        gte(transcriptLines.createdAt, keptSince(new Date(), days)),
      ),
    )
    .orderBy(asc(transcriptLines.seq));

  // Re-read through the same retention gate: an open panel may be hours old.
  if (new URL(request.url).searchParams.get("download") === "1") {
    return new Response(exportTranscript(lines), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="lor-${normalizeRoomCode(code)}-transcript.txt"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const [summary] = await db
    .select({ text: summaries.text, fromLines: summaries.fromLines })
    .from(summaries)
    .where(eq(summaries.roomId, room.id))
    .limit(1);

  return NextResponse.json(
    {
      lines,
      // Reported so the interface can say a summary is out of date rather than
      // showing a stale one as though it described the whole meeting.
      summary: summary
        ? { text: summary.text, fromLines: summary.fromLines, stale: summary.fromLines < lines.length }
        : null,
      retentionDays: days,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/transcript">,
) {
  const { code } = await params;
  const room = await findRoom(code);
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const speaker = typeof body?.speaker === "string" ? body.speaker.trim() : "";
  const identity = typeof body?.identity === "string" ? body.identity.trim() : "";

  if (!text || !identity) {
    return NextResponse.json({ error: "line_missing" }, { status: 400 });
  }

  const timing = readTranscriptTimingRequest(body);
  if (timing.kind === "invalid") {
    return NextResponse.json({ error: "timing_invalid" }, { status: 400 });
  }

  const db = getDb();

  // A browser only proposes the occurrence it received with its token. It
  // cannot define a meeting boundary: this query selects the server's active
  // occurrence for this room first, then compares it to that proposal. A stale
  // token or an unavailable presence observation is deliberately a normal
  // transcript line, not a failed caption and not an invented occurrence.
  const [activeOccurrence] =
    timing.kind === "timeline"
      ? await db
          .select({ id: meetingOccurrences.id })
          .from(meetingOccurrences)
          .where(
            and(
              eq(meetingOccurrences.roomId, room.id),
              isNull(meetingOccurrences.endedAt),
            ),
          )
          .limit(1)
      : [];

  // A ceiling on one room, so a meeting left running does not grow without
  // bound. Five thousand utterances is far longer than any meeting; reaching it
  // means something is wrong rather than that somebody talked a lot.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transcriptLines)
    .where(eq(transcriptLines.roomId, room.id));

  if (count >= MAX_LINES_PER_ROOM) {
    return NextResponse.json({ error: "transcript_full" }, { status: 409 });
  }

  // Arrival order at the server. Participants' clocks disagree by minutes, and
  // this is the only ordering everybody in the room shares.
  await db.insert(transcriptLines).values({
    roomId: room.id,
    speakerIdentity: identity.slice(0, 200),
    speakerName: (speaker || identity).slice(0, 200),
    text: text.slice(0, MAX_CAPTION_LENGTH),
    seq: count,
    ...(timing.kind === "timeline" && activeOccurrence?.id === timing.occurrenceId
      ? {
          occurrenceId: activeOccurrence.id,
          durationMs: timing.durationMs,
        }
      : {}),
  });

  return NextResponse.json({ stored: true }, { status: 201 });
}

/**
 * Take it all back.
 *
 * Not host-only. Anybody in the meeting can see the transcript, and somebody
 * who wants what they said removed should not have to find the person who
 * created the room. The blast radius is one room's own words.
 */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/rooms/[code]/transcript">,
) {
  const { code } = await params;
  const room = await findRoom(code);
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const db = getDb();

  // Derived records first. Generated Timeline records cascade from their
  // evidence rows, but a manual cue deliberately has no source line of its
  // own, so it must be removed explicitly with the whole kept record.
  // If cleanup fails, source lines stay available for a retry rather than
  // leaving a quote, marker, or summary with no deletion path.
  await db.delete(timelineManualMoments).where(eq(timelineManualMoments.roomId, room.id));
  await db.delete(actionItems).where(eq(actionItems.roomId, room.id));
  await db.delete(decisions).where(eq(decisions.roomId, room.id));
  await db.delete(summaries).where(eq(summaries.roomId, room.id));
  await db.delete(transcriptLines).where(eq(transcriptLines.roomId, room.id));

  return NextResponse.json({ deleted: true });
}
