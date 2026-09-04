import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb, knocks, rooms } from "@lor/db";
import { hostCookieName, verifyHostCookie } from "@/lib/host-cookie";
import { normalizeRoomCode } from "@/lib/room-code";

/**
 * The door, from the host's side.
 *
 * Both handlers verify the host cookie against the room row before anything
 * else. A guest with a valid token for the room is still not a host, and this
 * is the only thing standing between "can attend" and "decides who attends".
 */

/** How many waiting people to show at once. Beyond this, a host has other problems. */
const MAX_PENDING = 50;

async function requireHost(code: string) {
  const db = getDb();
  const [room] = await db
    .select({ id: rooms.id, hostSecretHash: rooms.hostSecretHash })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  if (!room) return null;

  const store = await cookies();
  const isHost = await verifyHostCookie(
    store.get(hostCookieName(code))?.value,
    code,
    room.hostSecretHash,
  );

  return isHost ? room : null;
}

/** Who is waiting, oldest first. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/rooms/[code]/waiting">,
) {
  const { code: rawCode } = await params;
  const code = normalizeRoomCode(rawCode);
  if (!code) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const room = await requireHost(code);
  // A room that does not exist and a room you do not host are the same answer.
  // Otherwise this route tells anyone which codes are real.
  if (!room) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const db = getDb();
  const waiting = await db
    .select({
      id: knocks.id,
      displayName: knocks.displayName,
      createdAt: knocks.createdAt,
    })
    .from(knocks)
    .where(and(eq(knocks.roomId, room.id), eq(knocks.status, "pending")))
    // Oldest first. A queue that reordered itself would mean whoever has waited
    // longest keeps being passed over.
    .orderBy(asc(knocks.createdAt))
    .limit(MAX_PENDING);

  return NextResponse.json({
    waiting: waiting.map((knock) => ({
      id: knock.id,
      name: knock.displayName,
      at: knock.createdAt.toISOString(),
    })),
  });
}

/** Let somebody in, or turn them away. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/waiting">,
) {
  const { code: rawCode } = await params;
  const code = normalizeRoomCode(rawCode);
  if (!code) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const room = await requireHost(code);
  if (!room) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  const decision = body?.decision;

  if (decision !== "admit" && decision !== "deny") {
    return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
  }

  const db = getDb();
  const [decided] = await db
    .update(knocks)
    .set({
      status: decision === "admit" ? "admitted" : "denied",
      decidedAt: new Date(),
    })
    .where(
      and(
        eq(knocks.id, id),
        // Scoped to this room, so a host of one room cannot decide a knock in
        // another by knowing its id.
        eq(knocks.roomId, room.id),
        // Only a pending knock. Deciding twice would let a refusal be undone by
        // a second press, which is the one thing the state machine forbids.
        eq(knocks.status, "pending"),
      ),
    )
    .returning({ id: knocks.id, status: knocks.status });

  if (!decided) {
    return NextResponse.json({ error: "not_pending" }, { status: 409 });
  }

  return NextResponse.json({ id: decided.id, status: decided.status });
}
