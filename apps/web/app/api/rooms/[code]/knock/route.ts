import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, knocks, rooms } from "@lor/db";
import { hostCookieName, verifyHostCookie } from "@/lib/host-cookie";
import { createKnockClaim } from "@/lib/knock-claim";
import { resolveKnock, type KnockStatus } from "@/lib/knock";
import { participantIdentity } from "@/lib/livekit";
import { notifyHosts } from "@/lib/room-notify";
import { callerKey, clientAddress, consume } from "@/lib/rate-limit";
import { normalizeRoomCode } from "@/lib/room-code";

/**
 * Ask to be let in.
 *
 * A link anyone can open needs a door, and we have no socket of our own to hold
 * one open. So the knock is a row: the visitor writes it, the host reads it, and
 * the visitor polls until it is answered. Everything that decides who gets in is
 * decided here and in the token route, never in the browser.
 */

/**
 * Thirty in five minutes, counted only when a knock is actually going to be
 * written.
 *
 * Both halves of that were wrong at first. The limit was consumed before the
 * room was even looked up, so once the client began knocking before every join,
 * a room with no waiting room at all still spent a slot on each person — and an
 * office behind one address ran out partway through filling a meeting. And ten
 * was too few regardless: a household, a classroom and a conference room all
 * share an address.
 *
 * Found by the end-to-end suite within an hour of it existing, which is what it
 * is for.
 */
const KNOCKS_PER_WINDOW = 30;
const WINDOW_SECONDS = 5 * 60;

const MAX_NAME_LENGTH = 60;

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/knock">,
) {
  const { code: rawCode } = await params;
  const code = normalizeRoomCode(rawCode);
  if (!code) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
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

  // The host is never held at their own door.
  //
  // Found by a headless browser, not by reading: with the waiting room on, the
  // host opened their own room and was told to wait — for themselves. Nobody
  // else could admit them either, so the room was unenterable by the only
  // person who could have opened it. The token route already exempted the host;
  // this route did not, and the client now knocks before asking for a token.
  const store = await cookies();
  const isHost = await verifyHostCookie(
    store.get(hostCookieName(code))?.value,
    code,
    room.hostSecretHash,
  );
  if (isHost) {
    return NextResponse.json({ outcome: "open" });
  }

  // A locked room is a stronger statement than a waiting room: the host has
  // stopped admitting people, so there is nobody to ask.
  if (room.locked) {
    return NextResponse.json({ error: "room_locked" }, { status: 403 });
  }

  // No door on this room. Said plainly rather than as an error, because the
  // caller's next step — go and get a token — is a normal one.
  if (!room.waitingRoomEnabled) {
    return NextResponse.json({ outcome: "open" });
  }

  // Counted here, where a knock is actually being made. Everything above this
  // point is a lookup that a person joining an ordinary meeting also performs.
  const requestHeaders = await headers();
  const limit = await consume(
    await callerKey("knock", clientAddress(requestHeaders)),
    KNOCKS_PER_WINDOW,
    WINDOW_SECONDS,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: limit.resetAt.toISOString() },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000)),
          ),
        },
      },
    );
  }

  const identity = await participantIdentity(room.livekitRoom, sessionId);

  const [existing] = await db
    .select({ status: knocks.status })
    .from(knocks)
    .where(
      and(eq(knocks.roomId, room.id), eq(knocks.participantIdentity, identity)),
    )
    .limit(1);

  const resolution = resolveKnock((existing?.status as KnockStatus) ?? null);

  if (!resolution.issueClaim) {
    return NextResponse.json({ outcome: resolution.outcome });
  }

  const { secretHash, claim } = await createKnockClaim();

  // `setWhere` is what closes the gap between the read above and this write. A
  // host who denies somebody in that gap must win: without the guard, the
  // refused visitor's own retry would quietly overwrite the refusal.
  const [written] = await db
    .insert(knocks)
    .values({
      roomId: room.id,
      participantIdentity: identity,
      displayName,
      claimSecretHash: secretHash,
    })
    .onConflictDoUpdate({
      target: [knocks.roomId, knocks.participantIdentity],
      set: { claimSecretHash: secretHash, displayName },
      setWhere: eq(knocks.status, "pending"),
    })
    .returning({ id: knocks.id, status: knocks.status });

  if (!written) {
    // The guard refused the write, so the status changed underneath us. Report
    // what is true now rather than the claim we were about to hand out.
    const [current] = await db
      .select({ status: knocks.status })
      .from(knocks)
      .where(
        and(eq(knocks.roomId, room.id), eq(knocks.participantIdentity, identity)),
      )
      .limit(1);

    return NextResponse.json({
      outcome: resolveKnock((current?.status as KnockStatus) ?? null).outcome,
    });
  }

  // Awaited rather than fired and forgotten: a serverless function that returns
  // may be frozen immediately, and a notification left in flight would simply
  // never arrive. It is written not to throw, and the host's list refetches on
  // a slow timer anyway.
  if (resolution.notifyHost) {
    await notifyHosts(room.livekitRoom, { type: "knock" });
  }

  return NextResponse.json({
    outcome: resolution.outcome,
    // The visitor's private handle on this knock. Never stored in this form.
    claim,
  });
}
