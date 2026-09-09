import { NextResponse } from "next/server";
import { and, asc, eq, gte } from "drizzle-orm";
import { decisions, getDb, transcriptLines } from "@lor/db";
import { findRoomAccess, hasRoomHostAccess, requireRoomHost } from "@/lib/room-access";
import { keptSince, retentionDays } from "@/lib/stt/retention";
import { sweepTranscript } from "@/lib/transcript-retention";

/** A decision is concise, but must still support a complete Arabic sentence. */
export const MAX_DECISION_LENGTH = 2_000;

// UUIDs are only identifiers here. Treat malformed IDs exactly like invisible
// records so this endpoint never becomes an oracle for room data.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isDecisionId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function decisionText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= MAX_DECISION_LENGTH ? text : null;
}

function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

/**
 * Read decisions in the same order as their transcript evidence.
 *
 * The API intentionally takes speaker, quote, and UTC time from the joined
 * source row instead of trusting even the stored snapshot. The snapshots are a
 * portable audit aid; the retained transcript is the canonical evidence.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/rooms/[code]/decisions">,
) {
  const { code: rawCode } = await params;
  const room = await findRoomAccess(rawCode);
  if (!room) return notFound();
  const isHost = await hasRoomHostAccess(room);

  const db = getDb();
  const days = retentionDays(process.env);
  const cutoff = keptSince(new Date(), days);
  await sweepTranscript(room.id, cutoff);

  const conditions = [
    eq(decisions.roomId, room.id),
    gte(transcriptLines.createdAt, cutoff),
  ];
  if (!isHost) conditions.push(eq(decisions.status, "confirmed"));

  const records = await db
    .select({
      id: decisions.id,
      status: decisions.status,
      origin: decisions.origin,
      text: decisions.text,
      createdAt: decisions.createdAt,
      confirmedAt: decisions.confirmedAt,
      seq: transcriptLines.seq,
      speaker: transcriptLines.speakerName,
      quote: transcriptLines.text,
      sourceAt: transcriptLines.createdAt,
    })
    .from(decisions)
    .innerJoin(transcriptLines, eq(decisions.sourceLineId, transcriptLines.id))
    .where(and(...conditions))
    .orderBy(asc(transcriptLines.seq), asc(decisions.createdAt));

  return NextResponse.json(
    {
      canReview: isHost,
      retentionDays: days,
      decisions: records.map((record) => ({
        id: record.id,
        status: record.status,
        origin: record.origin,
        text: record.text,
        createdAt: record.createdAt,
        confirmedAt: record.confirmedAt,
        source: {
          seq: record.seq,
          speaker: record.speaker,
          quote: record.quote,
          at: record.sourceAt,
        },
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Store a host-reviewed proposal from one transcript sequence.
 *
 * The caller may name a sequence, but every evidence column comes from the
 * selected row. That lets a later extractor use this endpoint without turning
 * an LLM response into an unverified transcript store.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/decisions">,
) {
  const { code: rawCode } = await params;
  const room = await requireRoomHost(rawCode);
  if (!room) return notFound();

  const body = await request.json().catch(() => null);
  const sourceSeq = Number.isInteger(body?.sourceSeq) && body.sourceSeq >= 0
    ? body.sourceSeq
    : null;
  const text = decisionText(body?.text);
  if (sourceSeq === null || !text) {
    return NextResponse.json({ error: "proposal_invalid" }, { status: 400 });
  }

  const db = getDb();
  const days = retentionDays(process.env);
  const cutoff = keptSince(new Date(), days);
  await sweepTranscript(room.id, cutoff);

  // `seq` is the only source reference this API accepts. A duplicate sequence
  // would be ambiguous evidence, so fail closed until the source is repaired.
  const sources = await db
    .select({
      id: transcriptLines.id,
      seq: transcriptLines.seq,
      speaker: transcriptLines.speakerName,
      quote: transcriptLines.text,
      createdAt: transcriptLines.createdAt,
    })
    .from(transcriptLines)
    .where(and(
      eq(transcriptLines.roomId, room.id),
      eq(transcriptLines.seq, sourceSeq),
      gte(transcriptLines.createdAt, cutoff),
    ))
    .limit(2);

  if (sources.length !== 1) return notFound();
  const [source] = sources;

  const [created] = await db
    .insert(decisions)
    .values({
      roomId: room.id,
      sourceLineId: source.id,
      sourceSeq: source.seq,
      sourceSpeaker: source.speaker,
      sourceQuote: source.quote,
      sourceCreatedAt: source.createdAt,
      text,
    })
    .returning({ id: decisions.id, status: decisions.status });

  return NextResponse.json({ id: created.id, status: created.status }, { status: 201 });
}

/** Confirm a proposal or edit only its final wording. */
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/decisions">,
) {
  const { code: rawCode } = await params;
  const room = await requireRoomHost(rawCode);
  if (!room) return notFound();

  const body = await request.json().catch(() => null);
  if (!isDecisionId(body?.id)) return notFound();

  const db = getDb();
  const now = new Date();

  if (body?.action === "confirm") {
    const [confirmed] = await db
      .update(decisions)
      .set({ status: "confirmed", confirmedAt: now, updatedAt: now })
      .where(and(
        eq(decisions.id, body.id),
        eq(decisions.roomId, room.id),
        eq(decisions.status, "proposed"),
      ))
      .returning({ id: decisions.id, status: decisions.status, confirmedAt: decisions.confirmedAt });

    return confirmed
      ? NextResponse.json(confirmed)
      : notFound();
  }

  if (body?.action === "edit") {
    const text = decisionText(body?.text);
    if (!text) return NextResponse.json({ error: "decision_text_invalid" }, { status: 400 });

    const [edited] = await db
      .update(decisions)
      // No source field appears in this set. Source evidence is immutable after
      // the server-derived insert, even for the meeting host.
      .set({ text, updatedAt: now })
      .where(and(eq(decisions.id, body.id), eq(decisions.roomId, room.id)))
      .returning({ id: decisions.id, status: decisions.status, text: decisions.text });

    return edited ? NextResponse.json(edited) : notFound();
  }

  return NextResponse.json({ error: "decision_action_invalid" }, { status: 400 });
}

/** Delete a proposal or confirmed record, never the source transcript line. */
export async function DELETE(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/decisions">,
) {
  const { code: rawCode } = await params;
  const room = await requireRoomHost(rawCode);
  if (!room) return notFound();

  const body = await request.json().catch(() => null);
  if (!isDecisionId(body?.id)) return notFound();

  const db = getDb();
  const [deleted] = await db
    .delete(decisions)
    .where(and(eq(decisions.id, body.id), eq(decisions.roomId, room.id)))
    .returning({ id: decisions.id });

  return deleted ? NextResponse.json({ deleted: true }) : notFound();
}
