import { NextResponse } from "next/server";
import { and, asc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import {
  getDb,
  meetingOccurrences,
  rooms,
  timelineManualMoments,
  transcriptLines,
} from "@lor/db";
import { participantIdentity, participantIsInRoom } from "@/lib/livekit";
import { callerKey, consume } from "@/lib/rate-limit";
import { findRoomAccess } from "@/lib/room-access";
import { keptSince, retentionDays } from "@/lib/stt/retention";
import { capturedSpeechTotals, readManualMomentLabel } from "@/lib/timeline";
import { sweepTranscript } from "@/lib/transcript-retention";

const SESSION_HEADER = "x-lor-session-id";
const MOMENTS_PER_MINUTE = 12;
const MOMENT_WINDOW_SECONDS = 60;

function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

async function sessionParticipantIdentity(headers: Headers, livekitRoom: string) {
  const sessionId = headers.get(SESSION_HEADER);
  if (!sessionId || sessionId.length < 16 || sessionId.length > 128) return null;
  return participantIdentity(livekitRoom, sessionId);
}

async function currentOccurrence(roomId: string) {
  const [occurrence] = await getDb()
    .select({ id: meetingOccurrences.id, startedAt: meetingOccurrences.startedAt })
    .from(meetingOccurrences)
    .where(and(eq(meetingOccurrences.roomId, roomId), isNull(meetingOccurrences.endedAt)))
    .limit(1);
  return occurrence ?? null;
}

async function hasRetainedTimelineRecord(roomId: string, occurrenceId: string, cutoff: Date) {
  const [line] = await getDb()
    .select({ id: transcriptLines.id })
    .from(transcriptLines)
    .where(and(
      eq(transcriptLines.roomId, roomId),
      eq(transcriptLines.occurrenceId, occurrenceId),
      isNotNull(transcriptLines.durationMs),
      gte(transcriptLines.createdAt, cutoff),
    ))
    .limit(1);
  return Boolean(line);
}

function unavailable(reason: "occurrence_unavailable" | "record_unavailable") {
  return {
    state: "unavailable" as const,
    reason,
    occurrence: null,
    moments: [],
    // This is deliberately not attendance or microphone-on time. There is no
    // useful value to return until an occurrence has retained caption spans.
    talkTime: { kind: "retained_caption_vad_span" as const, unit: "ms" as const, speakers: [] },
  };
}

/**
 * Read the current occurrence's compact timeline model.
 *
 * The API never takes an occurrence id: for a recurrent room, the server's
 * only active occurrence is the safe meeting record to expose while in a call.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/rooms/[code]/timeline">,
) {
  const { code: rawCode } = await params;
  const room = await findRoomAccess(rawCode);
  if (!room) return notFound();

  const cutoff = keptSince(new Date(), retentionDays(process.env));
  await sweepTranscript(room.id, cutoff);
  const occurrence = await currentOccurrence(room.id);
  if (!occurrence) {
    return NextResponse.json(unavailable("occurrence_unavailable"), {
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!(await hasRetainedTimelineRecord(room.id, occurrence.id, cutoff))) {
    return NextResponse.json(unavailable("record_unavailable"), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const db = getDb();
  const [moments, lines] = await Promise.all([
    db
      .select({
        id: timelineManualMoments.id,
        label: timelineManualMoments.label,
        at: timelineManualMoments.createdAt,
      })
      .from(timelineManualMoments)
      .where(and(
        eq(timelineManualMoments.roomId, room.id),
        eq(timelineManualMoments.occurrenceId, occurrence.id),
        gte(timelineManualMoments.createdAt, cutoff),
      ))
      .orderBy(asc(timelineManualMoments.createdAt), asc(timelineManualMoments.id)),
    db
      .select({
        identity: transcriptLines.speakerIdentity,
        name: transcriptLines.speakerName,
        durationMs: transcriptLines.durationMs,
        at: transcriptLines.createdAt,
        id: transcriptLines.id,
      })
      .from(transcriptLines)
      .where(and(
        eq(transcriptLines.roomId, room.id),
        eq(transcriptLines.occurrenceId, occurrence.id),
        isNotNull(transcriptLines.durationMs),
        gte(transcriptLines.createdAt, cutoff),
      ))
      .orderBy(asc(transcriptLines.createdAt), asc(transcriptLines.id)),
  ]);

  return NextResponse.json(
    {
      state: "available",
      occurrence,
      moments,
      talkTime: {
        // A fixed name makes the distinction consumable by a future UI and
        // export: this is not attendance, call length, or microphone-on time.
        kind: "retained_caption_vad_span",
        unit: "ms",
        speakers: capturedSpeechTotals(
          lines.map((line) => ({
            identity: line.identity,
            name: line.name,
            // `isNotNull` above and the paired database constraint guarantee
            // this is a captured VAD duration for a retained line.
            durationMs: line.durationMs!,
          })),
        ),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Mark this moment in the current retained occurrence.
 *
 * The caller provides at most participant-written label text. The occurrence
 * is selected under the same room-row lock used for occurrence boundaries, and
 * Postgres assigns the time, so neither may be forged from the browser.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/timeline">,
) {
  const { code: rawCode } = await params;
  const room = await findRoomAccess(rawCode);
  if (!room) return notFound();

  const participant = await sessionParticipantIdentity(request.headers, room.livekitRoom);
  if (!participant) {
    return NextResponse.json({ error: "participant_unavailable" }, { status: 403 });
  }
  // The session secret identifies the browser tab, but a copied/stale tab is
  // not a current participant. Marking is optional, so a presence failure is
  // an honest unavailable state rather than an excuse to create a hidden row.
  try {
    if (!(await participantIsInRoom(room.livekitRoom, participant))) {
      return NextResponse.json({ error: "participant_unavailable" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "participant_unavailable" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const label = readManualMomentLabel(body?.label);
  if (label.kind === "invalid") {
    return NextResponse.json({ error: "label_invalid" }, { status: 400 });
  }

  const cutoff = keptSince(new Date(), retentionDays(process.env));
  await sweepTranscript(room.id, cutoff);
  const initialOccurrence = await currentOccurrence(room.id);
  if (!initialOccurrence) {
    return NextResponse.json(unavailable("occurrence_unavailable"), { status: 409 });
  }
  if (!(await hasRetainedTimelineRecord(room.id, initialOccurrence.id, cutoff))) {
    return NextResponse.json(unavailable("record_unavailable"), { status: 409 });
  }

  // Rate-limit the marker endpoint only. The meeting, captions, and transcript
  // remain unaffected if somebody presses this control repeatedly.
  const limit = await consume(
    await callerKey("timeline-manual-moment", participant),
    MOMENTS_PER_MINUTE,
    MOMENT_WINDOW_SECONDS,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: limit.resetAt },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000))) },
      },
    );
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    // Coordinate with `recordMeetingOccurrence`, which takes this same room
    // lock only after its external presence observation completes.
    await tx.execute(sql`select 1 from ${rooms} where ${rooms.id} = ${room.id} for update`);
    const [occurrence] = await tx
      .select({ id: meetingOccurrences.id, startedAt: meetingOccurrences.startedAt })
      .from(meetingOccurrences)
      .where(and(eq(meetingOccurrences.roomId, room.id), isNull(meetingOccurrences.endedAt)))
      .limit(1);
    if (!occurrence) return { kind: "unavailable" as const, reason: "occurrence_unavailable" as const };

    const [record] = await tx
      .select({ id: transcriptLines.id })
      .from(transcriptLines)
      .where(and(
        eq(transcriptLines.roomId, room.id),
        eq(transcriptLines.occurrenceId, occurrence.id),
        isNotNull(transcriptLines.durationMs),
        gte(transcriptLines.createdAt, cutoff),
      ))
      .limit(1);
    if (!record) return { kind: "unavailable" as const, reason: "record_unavailable" as const };

    const [moment] = await tx
      .insert(timelineManualMoments)
      .values({ roomId: room.id, occurrenceId: occurrence.id, label: label.label })
      .returning({ id: timelineManualMoments.id, label: timelineManualMoments.label, at: timelineManualMoments.createdAt });
    if (!moment) throw new Error("Could not create timeline moment");
    return { kind: "created" as const, occurrence, moment };
  });

  if (result.kind === "unavailable") {
    return NextResponse.json(unavailable(result.reason), { status: 409 });
  }
  return NextResponse.json({ occurrence: result.occurrence, moment: result.moment }, { status: 201 });
}
