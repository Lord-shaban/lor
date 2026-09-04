import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb, rooms } from "@lor/db";
import {
  createHostCredential,
  hostCookieName,
  hostCookieOptions,
} from "@/lib/host-cookie";
import { participantIdentity } from "@/lib/livekit";
import { normalizeRoomCode } from "@/lib/room-code";

/**
 * Claim the host seat you were handed.
 *
 * The handover itself already revoked the previous host, so between that and
 * this call the room has no host at all. That gap is deliberate and it is
 * short: making revocation wait until the new host's browser got round to
 * claiming would mean somebody who has handed over still holding the room in
 * the meantime.
 *
 * No credential travels over the data channel. The notice that reaches the new
 * host says only "you have been made host"; the credential is minted here, over
 * HTTPS, for a caller who can prove they are the identity that was named.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/host">,
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

  const db = getDb();
  const [room] = await db
    .select({ id: rooms.id, livekitRoom: rooms.livekitRoom })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  if (!room) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Derived from a secret this browser keeps to itself, so being named is not
  // enough — you have to be the tab that was named.
  const identity = await participantIdentity(room.livekitRoom, sessionId);

  const { secretHash, cookieValue } = await createHostCredential(code);

  // One statement, so two tabs racing produce one host: the second finds
  // nothing pending. Clearing `pendingHost` here is also what makes the claim
  // single-use.
  const [updated] = await db
    .update(rooms)
    .set({
      hostSecretHash: secretHash,
      settings: sql`${rooms.settings} - 'pendingHost'`,
    })
    .where(
      sql`${rooms.id} = ${room.id} and ${rooms.settings} ->> 'pendingHost' = ${identity}`,
    )
    .returning({ id: rooms.id });

  if (!updated) {
    // Same answer as a room that does not exist, so this cannot be used to find
    // out whether a handover is in progress.
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const store = await cookies();
  store.set(hostCookieName(code), cookieValue, hostCookieOptions());

  return NextResponse.json({ isHost: true });
}
