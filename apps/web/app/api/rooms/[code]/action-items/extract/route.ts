import { NextResponse } from "next/server";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { actionItemProposalValues, actionItems, getDb, transcriptLines } from "@lor/db";
import { clientAddress, callerKey, consume } from "@/lib/rate-limit";
import { requireRoomHost } from "@/lib/room-access";
import {
  actionItemExtractionLimit,
  buildActionItemTranscript,
  extractActionItemCandidates,
  hasUsableActionItemTranscript,
  resolveActionItemCandidates,
} from "@/lib/llm/action-items";
import { configuredLlm } from "@/lib/llm/provider";
import { keptSince, retentionDays } from "@/lib/stt/retention";
import { sweepTranscript } from "@/lib/transcript-retention";

const DAY_SECONDS = 24 * 60 * 60;
const TIMEOUT_MS = 45_000;

function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

/**
 * Propose explicitly assigned commitments from retained meeting evidence.
 *
 * This route is host-only and user-triggered. It sends no request to an LLM
 * until the retained transcript, operator configuration, and daily quota have
 * all passed. A valid retry replaces only old LLM proposals, never work the
 * host already opened or completed.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/action-items/extract">,
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
      identity: transcriptLines.speakerIdentity,
      text: transcriptLines.text,
    })
    .from(transcriptLines)
    .where(and(eq(transcriptLines.roomId, room.id), gte(transcriptLines.createdAt, cutoff)))
    .orderBy(asc(transcriptLines.seq));

  // Check evidence and provider configuration before consuming quota or making
  // an outbound request. A host can retry freely once usable evidence exists.
  if (lines.length === 0) {
    return NextResponse.json({ error: "nothing_to_extract" }, { status: 404 });
  }
  if (!hasUsableActionItemTranscript(buildActionItemTranscript(lines))) {
    return NextResponse.json({ error: "transcript_too_short" }, { status: 422 });
  }

  const llm = configuredLlm(process.env);
  if (!llm) {
    return NextResponse.json({ error: "no_key" }, { status: 503 });
  }

  const limit = await consume(
    await callerKey("action-item-extraction", `${room.id}:${clientAddress(request.headers)}`),
    actionItemExtractionLimit(process.env),
    DAY_SECONDS,
  );
  if (!limit.allowed) return NextResponse.json({ error: "quota" }, { status: 429 });

  const extraction = await extractActionItemCandidates({
    lines,
    endpoint: llm.endpoint,
    model: llm.model,
    key: llm.key,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!extraction.ok) {
    const status = extraction.failure === "quota" ? 429
      : extraction.failure === "timeout" ? 504
        : extraction.failure === "no_key" || extraction.failure === "invalid_response" ? 502
          : 503;
    return NextResponse.json({ error: extraction.failure }, { status });
  }

  const sequences = extraction.candidates.map((candidate) => candidate.sourceSeq);
  const sources = sequences.length === 0
    ? []
    : await db
      .select({
        id: transcriptLines.id,
        seq: transcriptLines.seq,
        text: transcriptLines.text,
      })
      .from(transcriptLines)
      .where(and(
        eq(transcriptLines.roomId, room.id),
        inArray(transcriptLines.seq, sequences),
        gte(transcriptLines.createdAt, cutoff),
      ));

  // Source and owner resolution happens entirely after the provider response.
  // A malformed, cross-room, ambiguous, or invented reference rejects the
  // complete answer before it can delete a prior LLM proposal.
  const proposals = resolveActionItemCandidates(extraction.candidates, sources, lines);
  if (!proposals) return NextResponse.json({ error: "invalid_response" }, { status: 502 });

  const existing = await db
    .select({
      sourceLineId: actionItems.sourceLineId,
      status: actionItems.status,
      origin: actionItems.origin,
    })
    .from(actionItems)
    .where(eq(actionItems.roomId, room.id));
  const protectedSources = new Set(
    existing
      .filter((item) => item.status !== "proposed" || item.origin === "manual")
      .map((item) => item.sourceLineId),
  );
  const insertable = proposals.filter((proposal) => !protectedSources.has(proposal.sourceLineId));

  let createdCount = 0;
  await db.transaction(async (tx) => {
    await tx.delete(actionItems).where(and(
      eq(actionItems.roomId, room.id),
      eq(actionItems.status, "proposed"),
      eq(actionItems.origin, "llm"),
    ));

    if (insertable.length > 0) {
      const created = await tx
        .insert(actionItems)
        .values(insertable.map((proposal) => actionItemProposalValues({
          roomId: room.id,
          sourceLineId: proposal.sourceLineId,
          text: proposal.text,
          assigneeIdentity: proposal.assigneeIdentity,
          dueOn: proposal.dueOn,
          origin: "llm",
        })))
        // The unique source/text index makes simultaneous retries idempotent.
        .onConflictDoNothing()
        .returning({ id: actionItems.id });
      createdCount = created.length;
    }
  });

  return NextResponse.json(
    { proposed: createdCount, skipped: extraction.candidates.length - createdCount },
    { headers: { "Cache-Control": "no-store" } },
  );
}
