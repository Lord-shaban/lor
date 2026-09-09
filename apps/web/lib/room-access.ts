import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, rooms } from "@lor/db";
import { hostCookieName, verifyHostCookie } from "@/lib/host-cookie";
import { normalizeRoomCode } from "@/lib/room-code";

/** The minimum room data needed by host-protected meeting features. */
export interface RoomAccess {
  id: string;
  code: string;
  livekitRoom: string;
  hostSecretHash: string;
}

export async function findRoomAccess(rawCode: string): Promise<RoomAccess | null> {
  const code = normalizeRoomCode(rawCode);
  if (!code) return null;

  const [room] = await getDb()
    .select({
      id: rooms.id,
      livekitRoom: rooms.livekitRoom,
      hostSecretHash: rooms.hostSecretHash,
    })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  return room ? { ...room, code } : null;
}

export async function hasRoomHostAccess(room: RoomAccess): Promise<boolean> {
  const store = await cookies();
  return verifyHostCookie(
    store.get(hostCookieName(room.code))?.value,
    room.code,
    room.hostSecretHash,
  );
}

/** A guest, a revoked host, and a wrong-room credential are indistinguishable. */
export async function requireRoomHost(rawCode: string): Promise<RoomAccess | null> {
  const room = await findRoomAccess(rawCode);
  if (!room || !(await hasRoomHostAccess(room))) return null;

  return room;
}
