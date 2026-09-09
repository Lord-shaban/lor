import { NextResponse } from "next/server";
import { and, asc, eq, gte } from "drizzle-orm";
import { decisions, getDb, transcriptLines } from "@lor/db";
import { exportDecisions } from "@/lib/decision-export";
import { findRoomAccess } from "@/lib/room-access";
import { keptSince, retentionDays } from "@/lib/stt/retention";
import { sweepTranscript } from "@/lib/transcript-retention";

function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

/**
 * Download only settled, still-retained decisions. The join is intentional:
 * source snapshots help the database audit, but this response must be formed
 * from the exact transcript line that has survived its retention policy.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/rooms/[code]/decisions/export">,
) {
  const { code: rawCode } = await params;
  const room = await findRoomAccess(rawCode);
  if (!room) return notFound();

  const db = getDb();
  const cutoff = keptSince(new Date(), retentionDays(process.env));
  // Reapply retention here, even if the review panel was left open before a
  // source expired or somebody deleted the room's record.
  await sweepTranscript(room.id, cutoff);

  const records = await db
    .select({
      text: decisions.text,
      seq: transcriptLines.seq,
      speaker: transcriptLines.speakerName,
      quote: transcriptLines.text,
      at: transcriptLines.createdAt,
      createdAt: decisions.createdAt,
      id: decisions.id,
    })
    .from(decisions)
    .innerJoin(transcriptLines, eq(decisions.sourceLineId, transcriptLines.id))
    .where(and(
      eq(decisions.roomId, room.id),
      eq(decisions.status, "confirmed"),
      gte(transcriptLines.createdAt, cutoff),
    ))
    // `seq` is the meeting's canonical order. The secondary keys make an
    // anomalous duplicate sequence deterministic without changing it.
    .orderBy(asc(transcriptLines.seq), asc(decisions.createdAt), asc(decisions.id));

  if (records.length === 0) {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  return new Response(exportDecisions(records.map((record) => ({
    text: record.text,
    source: {
      seq: record.seq,
      speaker: record.speaker,
      quote: record.quote,
      at: record.at,
    },
  }))), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="lor-${room.code}-decisions.txt"`,
      "Cache-Control": "no-store",
    },
  });
}
