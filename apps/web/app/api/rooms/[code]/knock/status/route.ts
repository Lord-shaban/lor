import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, knocks, rooms } from "@lor/db";
import { verifyKnockClaim } from "@/lib/knock-claim";
import { participantIdentity } from "@/lib/livekit";
import { normalizeRoomCode } from "@/lib/room-code";

/**
 * Has the host answered yet?
 *
 * Polled, because we run no socket of our own. A couple of seconds between the
 * host pressing admit and the visitor being let in is the price of that, and it
 * is a price worth paying to keep the same code running on serverless and on a
 * single self-hosted box.
 *
 * The claim is what makes this private. Without it, a room full of people
 * waiting could read each other's requests and watch the host decide.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/knock/status">,
) {
  const { code: rawCode } = await params;
  const code = normalizeRoomCode(rawCode);
  if (!code) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const claim = typeof body?.claim === "string" ? body.claim : undefined;

  if (sessionId.length < 16 || sessionId.length > 128) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  const db = getDb();
  const [room] = await db
    .select({ id: rooms.id, livekitRoom: rooms.livekitRoom })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  if (!room) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const identity = await participantIdentity(room.livekitRoom, sessionId);

  const [knock] = await db
    .select({
      status: knocks.status,
      claimSecretHash: knocks.claimSecretHash,
    })
    .from(knocks)
    .where(
      and(eq(knocks.roomId, room.id), eq(knocks.participantIdentity, identity)),
    )
    .limit(1);

  // One answer for "no such knock" and for "not yours". The difference would
  // tell somebody who was refused whether other people are still waiting.
  if (!knock || !(await verifyKnockClaim(claim, knock.claimSecretHash))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ status: knock.status });
}
