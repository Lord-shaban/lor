import { NextResponse } from "next/server";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { decisions, getDb, transcriptLines } from "@lor/db";
import { clientAddress, callerKey, consume } from "@/lib/rate-limit";
import { requireRoomHost } from "@/lib/room-access";
import {
  buildDecisionTranscript,
  decisionExtractionLimit,
  extractDecisionCandidates,
  hasUsableDecisionTranscript,
} from "@/lib/llm/decisions";
import { configuredLlm } from "@/lib/llm/provider";
import { keptSince, retentionDays } from "@/lib/stt/retention";
import { sweepTranscript } from "@/lib/transcript-retention";

const DAY_SECONDS = 24 * 60 * 60;
const TIMEOUT_MS = 45_000;
function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

/**
 * Generate review-only decisions from retained evidence.
 *
 * This is host-only: guests must not be able to spend the operator's key or
 * alter the review queue. A successful retry replaces only previous LLM
 * proposals; confirmed and host-authored decisions are never changed.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/decisions/extract">,
) {
  const { code: rawCode } = await params;
  const room = await requireRoomHost(rawCode);
  if (!room) return notFound();

  const db = getDb();
  const cutoff = keptSince(new Date(), retentionDays(process.env));
  await sweepTranscript(room.id, cutoff);

  const lines = await db
    .select({
      seq: transcriptLines.seq,
      speaker: transcriptLines.speakerName,
      text: transcriptLines.text,
    })
    .from(transcriptLines)
    .where(and(eq(transcriptLines.roomId, room.id), gte(transcriptLines.createdAt, cutoff)))
    .orderBy(asc(transcriptLines.seq));

  // Do these checks before quota or provider activity. A room without a usable
  // retained transcript must be free to retry once there is actual evidence.
  if (lines.length === 0) {
    return NextResponse.json({ error: "nothing_to_extract" }, { status: 404 });
  }
  if (!hasUsableDecisionTranscript(buildDecisionTranscript(lines))) {
    return NextResponse.json({ error: "transcript_too_short" }, { status: 422 });
  }

  const llm = configuredLlm(process.env);
  if (!llm) {
    return NextResponse.json({ error: "no_key" }, { status: 503 });
  }

  const limit = await consume(
    await callerKey("decision-extraction", `${room.id}:${clientAddress(request.headers)}`),
    decisionExtractionLimit(process.env),
    DAY_SECONDS,
  );
  if (!limit.allowed) return NextResponse.json({ error: "quota" }, { status: 429 });

  const extraction = await extractDecisionCandidates({
    lines,
    endpoint: llm.endpoint,
    model: llm.model,
    key: llm.key,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!extraction.ok) {
    const status = extraction.failure === "quota" ? 429
      : extraction.failure === "no_key" || extraction.failure === "invalid_response" ? 502
        : 503;
    return NextResponse.json({ error: extraction.failure }, { status });
  }

  const sequences = extraction.candidates.map((candidate) => candidate.sourceSeq);
  const sources = sequences.length === 0
    ? []
    : await db
      .select({ id: transcriptLines.id, seq: transcriptLines.seq, speaker: transcriptLines.speakerName, quote: transcriptLines.text, createdAt: transcriptLines.createdAt })
      .from(transcriptLines)
      .where(and(
        eq(transcriptLines.roomId, room.id),
        inArray(transcriptLines.seq, sequences),
        gte(transcriptLines.createdAt, cutoff),
      ));

  // A model may not point outside the current retained room, or at a duplicate
  // sequence. Reject its entire response rather than persisting a partial list
  // that looks complete to a reviewer.
  if (sources.length !== sequences.length) {
    return NextResponse.json({ error: "invalid_response" }, { status: 502 });
  }

  const sourceBySequence = new Map(sources.map((source) => [source.seq, source]));
  const existing = await db
    .select({ sourceLineId: decisions.sourceLineId, status: decisions.status, origin: decisions.origin })
    .from(decisions)
    .where(eq(decisions.roomId, room.id));
  const protectedSources = new Set(
    existing
      .filter((decision) => decision.status === "confirmed" || decision.origin === "manual")
      .map((decision) => decision.sourceLineId),
  );

  // A confirmed or host-authored decision is not overwritten or duplicated on
  // retry. LLM proposals are intentionally replaced below after a successful
  // response, so stale candidates disappear when the transcript changes.
  const proposals = extraction.candidates
    .map((candidate) => ({ candidate, source: sourceBySequence.get(candidate.sourceSeq)! }))
    .filter(({ source }) => !protectedSources.has(source.id));

  let createdCount = 0;
  await db.transaction(async (tx) => {
    await tx.delete(decisions).where(and(
      eq(decisions.roomId, room.id),
      eq(decisions.status, "proposed"),
      eq(decisions.origin, "llm"),
    ));

    if (proposals.length > 0) {
      const created = await tx
        .insert(decisions)
        .values(proposals.map(({ candidate, source }) => ({
          roomId: room.id,
          sourceLineId: source.id,
          sourceSeq: source.seq,
          sourceSpeaker: source.speaker,
          sourceQuote: source.quote,
          sourceCreatedAt: source.createdAt,
          text: candidate.text,
          origin: "llm" as const,
        })))
        // The schema's unique source index makes simultaneous retries safe.
        .onConflictDoNothing()
        .returning({ id: decisions.id });
      createdCount = created.length;
    }
  });

  return NextResponse.json(
    { proposed: createdCount, skipped: extraction.candidates.length - createdCount },
    { headers: { "Cache-Control": "no-store" } },
  );
}
