import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb, rooms } from "@lor/db";
import { hostCookieName, verifyHostCookie } from "@/lib/host-cookie";
import { normalizeRoomCode } from "@/lib/room-code";
import { MAX_GLOSSARY_TERMS, cleanGlossary } from "@/lib/stt/prompt";
import { readGlossary } from "@/lib/stt/glossary";

/**
 * The words this room uses.
 *
 * A team that says "Vercel" forty times in a meeting should have it spelled
 * correctly from the second time, and the cheapest way to arrange that is to
 * tell the model the word exists before it hears it. This is where the room
 * says so.
 *
 * The list is read by anyone who can open the room — it is nothing but their
 * own vocabulary, and the caption strip will want to show it — and written only
 * by the host, like every other room setting.
 */

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/rooms/[code]/glossary">,
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

  return NextResponse.json({ terms: readGlossary(room.settings) });
}

export async function PUT(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/glossary">,
) {
  const { code: rawCode } = await params;
  const code = normalizeRoomCode(rawCode);
  if (!code) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const db = getDb();
  const [room] = await db
    .select({ id: rooms.id, hostSecretHash: rooms.hostSecretHash })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  // A room that does not exist and a room you do not host are the same answer,
  // or this route tells anyone which codes are real.
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const store = await cookies();
  const isHost = await verifyHostCookie(
    store.get(hostCookieName(code))?.value,
    code,
    room.hostSecretHash,
  );
  if (!isHost) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.terms)) {
    return NextResponse.json({ error: "terms_missing" }, { status: 400 });
  }

  // Cleaned here rather than trusted: this list is sent to a paid API on the
  // operator's key, and an unbounded one is both a cost and a way to push the
  // code-switched example out of the window the model actually reads.
  const terms = cleanGlossary(
    body.terms.filter((term: unknown) => typeof term === "string"),
  ).slice(0, MAX_GLOSSARY_TERMS);

  // One statement, merging into whatever else `settings` holds. Reading the
  // object and writing it back would drop a change another route made in
  // between — the waiting room, or the pending host.
  await db
    .update(rooms)
    .set({
      settings: sql`${rooms.settings} || ${JSON.stringify({ glossary: terms })}::jsonb`,
    })
    .where(eq(rooms.id, room.id));

  return NextResponse.json({ terms });
}
