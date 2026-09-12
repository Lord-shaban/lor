import { NextResponse } from "next/server";
import { and, asc, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
  getDb,
  meetingOccurrences,
  rooms,
  timelineChapters,
  timelineGeneratedMoments,
  transcriptLines,
} from "@lor/db";
import { clientAddress, callerKey, consume } from "@/lib/rate-limit";
import { requireRoomHost } from "@/lib/room-access";
import {
  buildTimelineTranscript,
  candidatesReferenceOnlyTimelineLines,
  generateTimelineCandidates,
  hasUsableTimelineTranscript,
  resolveTimelineCandidates,
  timelineGenerationLimit,
  timelineTranscriptLines,
} from "@/lib/llm/timeline";
import { configuredLlm } from "@/lib/llm/provider";
import { keptSince, retentionDays } from "@/lib/stt/retention";
import { sweepTranscript } from "@/lib/transcript-retention";

const DAY_SECONDS = 24 * 60 * 60;
const TIMEOUT_MS = 45_000;

function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

/**
 * Generate chapters and automatic important moments from one current,
 * occurrence-scoped retained record. The model returns only title/range/seq;
 * this route resolves every durable reference and server time itself.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/timeline/generate">,
) {
  const { code: rawCode } = await params;
  const room = await requireRoomHost(rawCode);
  if (!room) return notFound();

  const db = getDb();
  const cutoff = keptSince(new Date(), retentionDays(process.env));
  await sweepTranscript(room.id, cutoff);

  const [occurrence] = await db
    .select({ id: meetingOccurrences.id })
    .from(meetingOccurrences)
    .where(and(eq(meetingOccurrences.roomId, room.id), isNull(meetingOccurrences.endedAt)))
    .limit(1);
  if (!occurrence) {
    return NextResponse.json({ error: "occurrence_unavailable" }, { status: 409 });
  }

  const retained = await db
    .select({
      id: transcriptLines.id,
      seq: transcriptLines.seq,
      speaker: transcriptLines.speakerName,
      text: transcriptLines.text,
      at: transcriptLines.createdAt,
    })
    .from(transcriptLines)
    .where(and(
      eq(transcriptLines.roomId, room.id),
      eq(transcriptLines.occurrenceId, occurrence.id),
      isNotNull(transcriptLines.durationMs),
      gte(transcriptLines.createdAt, cutoff),
    ))
    .orderBy(asc(transcriptLines.seq), asc(transcriptLines.createdAt), asc(transcriptLines.id));

  const promptLines = timelineTranscriptLines(retained);
  if (promptLines.length === 0) {
    return NextResponse.json({ error: "nothing_to_generate" }, { status: 404 });
  }
  if (!hasUsableTimelineTranscript(buildTimelineTranscript(promptLines))) {
    return NextResponse.json({ error: "transcript_too_short" }, { status: 422 });
  }

  const llm = configuredLlm(process.env);
  if (!llm) return NextResponse.json({ error: "no_key" }, { status: 503 });

  const limit = await consume(
    await callerKey("timeline-generation", `${room.id}:${clientAddress(request.headers)}`),
    timelineGenerationLimit(process.env),
    DAY_SECONDS,
  );
  if (!limit.allowed) return NextResponse.json({ error: "quota" }, { status: 429 });

  const generation = await generateTimelineCandidates({
    lines: promptLines,
    endpoint: llm.endpoint,
    model: llm.model,
    key: llm.key,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!generation.ok) {
    const status = generation.failure === "quota" ? 429
      : generation.failure === "timeout" ? 504
        : generation.failure === "no_key" || generation.failure === "invalid_response" ? 502
          : 503;
    return NextResponse.json({ error: generation.failure }, { status });
  }

  // A handover while the provider was working revokes the old host's ability
  // to replace generated navigation records. Do this before the only writes.
  if (!(await requireRoomHost(rawCode))) return notFound();

  const referencedSequences = [
    ...generation.candidates.chapters.flatMap((chapter) => [chapter.startSeq, chapter.endSeq]),
    ...generation.candidates.moments.map((moment) => moment.sourceSeq),
  ];
  // The provider must not be able to guess a valid sequence from an older,
  // truncated line. Only evidence it actually received is admissible.
  if (!candidatesReferenceOnlyTimelineLines(generation.candidates, promptLines)) {
    return NextResponse.json({ error: "invalid_response" }, { status: 502 });
  }
  const result = await db.transaction(async (tx) => {
    // Occurrence boundary writes use this same lock after their LiveKit
    // observation. A completed request may never write into a newer occurrence.
    await tx.execute(sql`select 1 from ${rooms} where ${rooms.id} = ${room.id} for update`);
    const [currentOccurrence] = await tx
      .select({ id: meetingOccurrences.id })
      .from(meetingOccurrences)
      .where(and(eq(meetingOccurrences.roomId, room.id), isNull(meetingOccurrences.endedAt)))
      .limit(1);
    if (!currentOccurrence || currentOccurrence.id !== occurrence.id) {
      return { kind: "occurrence_unavailable" as const };
    }

    const sourceRows = referencedSequences.length === 0
      ? []
      : await tx
        .select({
          id: transcriptLines.id,
          seq: transcriptLines.seq,
          at: transcriptLines.createdAt,
        })
        .from(transcriptLines)
        .where(and(
          eq(transcriptLines.roomId, room.id),
          eq(transcriptLines.occurrenceId, occurrence.id),
          isNotNull(transcriptLines.durationMs),
          gte(transcriptLines.createdAt, cutoff),
          inArray(transcriptLines.seq, referencedSequences),
        ));
    if (sourceRows.length !== new Set(referencedSequences).size) {
      return { kind: "invalid_response" as const };
    }
    const resolved = resolveTimelineCandidates(generation.candidates, sourceRows);
    if (!resolved) return { kind: "invalid_response" as const };

    // Only a fully parsed and evidence-resolved result replaces the previous
    // generated set. Manual moments live in another table and are untouched.
    await tx.delete(timelineGeneratedMoments).where(and(
      eq(timelineGeneratedMoments.roomId, room.id),
      eq(timelineGeneratedMoments.occurrenceId, occurrence.id),
    ));
    await tx.delete(timelineChapters).where(and(
      eq(timelineChapters.roomId, room.id),
      eq(timelineChapters.occurrenceId, occurrence.id),
    ));

    if (resolved.chapters.length > 0) {
      await tx.insert(timelineChapters).values(resolved.chapters.map(({ title, start, end }) => ({
        roomId: room.id,
        occurrenceId: occurrence.id,
        title,
        sourceStartLineId: start.id,
        sourceStartSeq: start.seq,
        sourceStartAt: start.at,
        sourceEndLineId: end.id,
        sourceEndSeq: end.seq,
        sourceEndAt: end.at,
      })));
    }
    if (resolved.moments.length > 0) {
      await tx.insert(timelineGeneratedMoments).values(resolved.moments.map((source) => ({
        roomId: room.id,
        occurrenceId: occurrence.id,
        sourceLineId: source.id,
        sourceSeq: source.seq,
        sourceAt: source.at,
      })));
    }

    return {
      kind: "generated" as const,
      chapters: resolved.chapters.length,
      moments: resolved.moments.length,
    };
  });

  if (result.kind === "occurrence_unavailable") {
    return NextResponse.json({ error: "occurrence_unavailable" }, { status: 409 });
  }
  if (result.kind === "invalid_response") {
    return NextResponse.json({ error: "invalid_response" }, { status: 502 });
  }
  return NextResponse.json(
    { generated: { chapters: result.chapters, moments: result.moments } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
