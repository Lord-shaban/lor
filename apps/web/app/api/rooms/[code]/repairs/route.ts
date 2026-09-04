import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb, rooms } from "@lor/db";
import { normalizeRoomCode } from "@/lib/room-code";
import { cleanGlossary } from "@/lib/stt/prompt";
import { readGlossary } from "@/lib/stt/glossary";
import { MAX_REPAIRS, cleanRepairs, readRepairs, type Repair } from "@/lib/stt/repair";

/**
 * Corrections somebody made to a caption, so the same mistake stops happening.
 *
 * Unlike the glossary, this is **not** host-only. A correction is a fact about
 * a word that anybody in the room can see is wrong, and making people wait for
 * the host to fix a term the whole meeting is misreading would mean nobody ever
 * fixes it. The blast radius is bounded by `cleanRepairs`: one Arabic word
 * mapped to one Latin one, forty of them at most, in this room only.
 *
 * A correction also enters the glossary, because the two things want the same
 * information from opposite ends. The glossary tells the model the word exists
 * before it guesses; the repair fixes the guess it made anyway. Correcting
 * "ديبلوي" to "deploy" should mean the *next* meeting gets it right without
 * anybody correcting anything.
 */

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/rooms/[code]/repairs">,
) {
  const { code: rawCode } = await params;
  const code = normalizeRoomCode(rawCode);
  if (!code) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const db = getDb();
  const [room] = await db
    .select({ settings: rooms.settings })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ repairs: readRepairs(room.settings) });
}

/**
 * Add one correction, or remove one.
 *
 * A whole-list PUT would let one participant's stale copy undo everybody
 * else's corrections. Two people fixing two different words in the same
 * meeting is the normal case, not the edge one.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/repairs">,
) {
  const { code: rawCode } = await params;
  const code = normalizeRoomCode(rawCode);
  if (!code) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const from = typeof body?.from === "string" ? body.from : null;
  const to = typeof body?.to === "string" ? body.to : null;
  const remove = body?.remove === true;

  if (!from || (!remove && !to)) {
    return NextResponse.json({ error: "correction_missing" }, { status: 400 });
  }

  const db = getDb();
  const [room] = await db
    .select({ id: rooms.id, settings: rooms.settings })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const existing = readRepairs(room.settings);

  let repairs: Repair[];
  if (remove) {
    repairs = existing.filter((repair) => repair.from !== from);
  } else {
    // The new one first: `cleanRepairs` keeps the first rule for a word, so a
    // correction of an already-corrected term replaces it rather than being
    // silently ignored by the rule that was already wrong.
    repairs = cleanRepairs([{ from, to: to! }, ...existing]).slice(0, MAX_REPAIRS);
  }

  // Nothing survived cleaning, so there is nothing to write and nothing the
  // caller can do about it beyond being told.
  if (!remove && repairs.length === existing.length &&
      !repairs.some((r) => r.from === from)) {
    return NextResponse.json({ error: "correction_refused" }, { status: 422 });
  }

  // The correction also becomes a glossary term, so the model is told the word
  // exists before it has a chance to mishear it again.
  const glossary = remove
    ? readGlossary(room.settings)
    : cleanGlossary([to!, ...readGlossary(room.settings)]);

  await db
    .update(rooms)
    .set({
      settings: sql`${rooms.settings} || ${JSON.stringify({ repairs, glossary })}::jsonb`,
    })
    .where(eq(rooms.id, room.id));

  return NextResponse.json({ repairs, glossary });
}
