import { NextResponse } from "next/server";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb, rooms, summaries, transcriptLines } from "@lor/db";
import { normalizeRoomCode } from "@/lib/room-code";
import { keptSince, retentionDays } from "@/lib/stt/retention";
import { MAX_CAPTION_LENGTH } from "@/lib/data-channel";

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
 * - **Deleting takes the summary too.** Otherwise deletion leaves behind a
 *   derived copy of exactly what was deleted.
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

/**
 * Drop what is past its time.
 *
 * Done on the way through rather than by a scheduled job: this deployment has
 * no scheduler, and a retention promise that depends on one that does not exist
 * is not a promise. It is one statement against an indexed column.
 */
async function sweep(roomId: string) {
  const db = getDb();
  const cutoff = keptSince(new Date(), retentionDays(process.env));

  await db
    .delete(transcriptLines)
    .where(and(eq(transcriptLines.roomId, roomId), lt(transcriptLines.createdAt, cutoff)));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/rooms/[code]/transcript"> ,
) {
  const { code } = await params;
  const room = await findRoom(code);
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await sweep(room.id);

  const db = getDb();
  const days = retentionDays(process.env);
  const lines = await db
    .select({
      speaker: transcriptLines.speakerName,
      text: transcriptLines.text,
      seq: transcriptLines.seq,
      at: transcriptLines.createdAt,
    })
    .from(transcriptLines)
    .where(
      and(
        eq(transcriptLines.roomId, room.id),
        gte(transcriptLines.createdAt, keptSince(new Date(), days)),
      ),
    )
    .orderBy(asc(transcriptLines.seq));

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

  const db = getDb();

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

  // The summary first. If only one of the two can happen, the copy derived from
  // the transcript is the worse thing to leave behind.
  await db.delete(summaries).where(eq(summaries.roomId, room.id));
  await db.delete(transcriptLines).where(eq(transcriptLines.roomId, room.id));

  return NextResponse.json({ deleted: true });
}
