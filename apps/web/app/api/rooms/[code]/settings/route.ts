import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, rooms } from "@lor/db";
import { hostCookieName, verifyHostCookie } from "@/lib/host-cookie";
import { normalizeRoomCode } from "@/lib/room-code";

/**
 * What the host may change about their room.
 *
 * Deliberately a short list of booleans rather than a general "patch the room"
 * route. A room row carries its own code, its host secret hash and its LiveKit
 * room name, and none of those are things a request should be able to reach —
 * so the fields are enumerated here rather than filtered out of a body.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/settings">,
) {
  const { code: rawCode } = await params;
  const code = normalizeRoomCode(rawCode);
  if (!code) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const db = getDb();
  const [room] = await db
    .select({ id: rooms.id, hostSecretHash: rooms.hostSecretHash })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  // A room that does not exist and a room you do not host are the same answer,
  // or this route tells anyone which codes are real.
  if (!room) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const store = await cookies();
  const isHost = await verifyHostCookie(
    store.get(hostCookieName(code))?.value,
    code,
    room.hostSecretHash,
  );
  if (!isHost) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  const changes: { waitingRoomEnabled?: boolean } = {};
  if (typeof body?.waitingRoom === "boolean") {
    changes.waitingRoomEnabled = body.waitingRoom;
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: "nothing_to_change" }, { status: 400 });
  }

  const [updated] = await db
    .update(rooms)
    .set(changes)
    .where(eq(rooms.id, room.id))
    .returning({ waitingRoom: rooms.waitingRoomEnabled });

  return NextResponse.json(updated);
}
