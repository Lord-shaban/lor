import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, knocks, rooms } from "@lor/db";
import { hostCookieName, verifyHostCookie } from "@/lib/host-cookie";
import { createAccessToken, participantIdentity } from "@/lib/livekit";
import { callerKey, clientAddress, consume } from "@/lib/rate-limit";
import { normalizeRoomCode } from "@/lib/room-code";

/**
 * Mint an access token for a room.
 *
 * This is the gate. Everything that decides who may join, and who may turn a
 * camera on once inside, is decided here and nowhere else — the client is told
 * the outcome, never asked for it.
 */

/** Generous: a flaky connection legitimately re-mints on every reconnect. */
const TOKENS_PER_MINUTE = 30;
const WINDOW_SECONDS = 60;

const MAX_NAME_LENGTH = 60;

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/token">,
) {
  const { code: rawCode } = await params;
  const code = normalizeRoomCode(rawCode);
  if (!code) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const requestHeaders = await headers();
  const limit = await consume(
    await callerKey("token", clientAddress(requestHeaders)),
    TOKENS_PER_MINUTE,
    WINDOW_SECONDS,
  );
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));

  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  // Short or absent session ids would collide across participants, and a
  // collision in LiveKit means one person silently evicts another.
  if (sessionId.length < 16 || sessionId.length > 128) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  const displayName =
    typeof body?.name === "string"
      ? body.name.trim().slice(0, MAX_NAME_LENGTH)
      : "";
  if (!displayName) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  const db = getDb();
  const [room] = await db
    .select({
      id: rooms.id,
      livekitRoom: rooms.livekitRoom,
      hostSecretHash: rooms.hostSecretHash,
      locked: rooms.locked,
      waitingRoomEnabled: rooms.waitingRoomEnabled,
    })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  if (!room) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const store = await cookies();
  const isHost = await verifyHostCookie(
    store.get(hostCookieName(code))?.value,
    code,
    room.hostSecretHash,
  );

  // A locked room stops admitting people. The host is exempt, or locking
  // yourself out of your own meeting would be one click away.
  if (room.locked && !isHost) {
    return NextResponse.json({ error: "room_locked" }, { status: 403 });
  }

  const identity = await participantIdentity(room.livekitRoom, sessionId);

  // One lookup, two questions. The row is per participant, not per room:
  // matching any admitted knock would mean the first person let in silently
  // admitted everyone else still waiting.
  const [knock] = await db
    .select({ status: knocks.status })
    .from(knocks)
    .where(
      and(eq(knocks.roomId, room.id), eq(knocks.participantIdentity, identity)),
    )
    .limit(1);

  // Denied means not welcome, whether the door is on or off. It is what a
  // removal writes, and it is why removal survives a reload: the block lives on
  // the identity rather than in the browser that was removed.
  if (knock?.status === "denied" && !isHost) {
    return NextResponse.json({ error: "removed" }, { status: 403 });
  }

  // With a waiting room on, a guest publishes nothing until the host says so.
  // They still get a token: they need the data channel to knock and to hear
  // that they were admitted. What they do not get is a camera or a microphone.
  const canPublish =
    !room.waitingRoomEnabled || isHost || knock?.status === "admitted";

  const token = await createAccessToken({
    livekitRoom: room.livekitRoom,
    identity,
    displayName,
    canPublish,
    isHost,
  });

  // Touch the room so idle ones can be reaped without deleting live meetings.
  await db
    .update(rooms)
    .set({ lastSeenAt: new Date() })
    .where(eq(rooms.id, room.id));

  return NextResponse.json({
    token,
    // The client needs this to connect and has no other way to learn it.
    serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    identity,
    canPublish,
    isHost,
  });
}
