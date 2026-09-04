import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { getDb, knocks, rooms } from "@lor/db";
import { hashClaimSecret } from "@/lib/knock-claim";
import { hostCookieName, verifyHostCookie } from "@/lib/host-cookie";
import { HOST_METADATA } from "@/lib/livekit";
import { announceToRoom } from "@/lib/room-notify";
import { normalizeRoomCode } from "@/lib/room-code";

/**
 * What a host may do to somebody else.
 *
 * Every action here is one the media server performs, not one the browser asks
 * a peer to perform. A "please mute yourself" message would be a request, and a
 * participant who ignored it would simply stay unmuted — moderation that only
 * works against people who cooperate is not moderation.
 *
 * Nothing here can turn anything *on*. A host can close a microphone but never
 * open one, and can stop a screen share but never start one. Being silenced is
 * recoverable; having your microphone opened for you is not.
 */

function client(): RoomServiceClient | null {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return null;
  return new RoomServiceClient(url.replace(/^ws/, "http"), apiKey, apiSecret);
}

function isHostMetadata(metadata: string | undefined): boolean {
  if (!metadata) return false;
  if (metadata === HOST_METADATA) return true;
  try {
    return JSON.parse(metadata)?.host === true;
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/mod">,
) {
  const { code: rawCode } = await params;
  const code = normalizeRoomCode(rawCode);
  if (!code) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const db = getDb();
  const [room] = await db
    .select({
      id: rooms.id,
      livekitRoom: rooms.livekitRoom,
      hostSecretHash: rooms.hostSecretHash,
    })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  if (!room) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // The whole endpoint rests on this line. A guest holds a valid token for the
  // same room and is still not a host; only the cookie says otherwise, and only
  // the room row says the cookie is still current.
  const store = await cookies();
  const isHost = await verifyHostCookie(
    store.get(hostCookieName(code))?.value,
    code,
    room.hostSecretHash,
  );
  if (!isHost) {
    // Not 403. A room you do not host answers the same as one that is not
    // there, so this cannot be used to find out which codes are real.
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  const identity = typeof body?.identity === "string" ? body.identity : "";

  const service = client();
  if (!service) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const participants = await service
    .listParticipants(room.livekitRoom)
    .catch(() => []);

  const named = (id: string) =>
    participants.find((participant) => participant.identity === id);

  switch (action) {
    case "mute": {
      const target = named(identity);
      if (!target) {
        return NextResponse.json({ error: "not_in_room" }, { status: 404 });
      }

      await muteSource(service, room.livekitRoom, target, TrackSource.MICROPHONE);
      await announceToRoom(room.livekitRoom, {
        type: "moderation",
        action: "mute",
        name: target.name || target.identity,
      });
      return NextResponse.json({ ok: true });
    }

    case "muteAll": {
      // Never the host. Muting yourself along with everyone else turns "quiet
      // down" into "the meeting stops", which is not what the button says.
      const others = participants.filter(
        (participant) => !isHostMetadata(participant.metadata),
      );

      await Promise.all(
        others.map((participant) =>
          muteSource(
            service,
            room.livekitRoom,
            participant,
            TrackSource.MICROPHONE,
          ),
        ),
      );

      await announceToRoom(room.livekitRoom, {
        type: "moderation",
        action: "muteAll",
        name: "",
      });
      return NextResponse.json({ ok: true, muted: others.length });
    }

    case "stopShare": {
      const target = named(identity);
      if (!target) {
        return NextResponse.json({ error: "not_in_room" }, { status: 404 });
      }

      await muteSource(
        service,
        room.livekitRoom,
        target,
        TrackSource.SCREEN_SHARE,
      );
      await announceToRoom(room.livekitRoom, {
        type: "moderation",
        action: "stopShare",
        name: target.name || target.identity,
      });
      return NextResponse.json({ ok: true });
    }

    case "remove": {
      const target = named(identity);
      if (!target) {
        return NextResponse.json({ error: "not_in_room" }, { status: 404 });
      }

      const name = target.name || target.identity;

      // Written before the disconnect, not after. Between the two there is a
      // moment where the person is out of the room, and if the block were
      // written second they could rejoin inside it.
      //
      // A refusal is a refusal however it was reached, so this reuses the same
      // row the waiting room uses. The claim secret is one nobody holds: this
      // knock exists to say no, and there is nothing here for its subject to
      // poll.
      await db
        .insert(knocks)
        .values({
          roomId: room.id,
          participantIdentity: target.identity,
          displayName: name,
          claimSecretHash: await hashClaimSecret(crypto.randomUUID()),
          status: "denied",
          decidedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [knocks.roomId, knocks.participantIdentity],
          set: { status: "denied", decidedAt: new Date(), displayName: name },
        });

      await service
        .removeParticipant(room.livekitRoom, target.identity)
        .catch(() => {
          // Already gone. The block is what matters and it is written.
        });

      await announceToRoom(room.livekitRoom, {
        type: "moderation",
        action: "remove",
        name,
      });
      return NextResponse.json({ ok: true });
    }

    case "lock":
    case "unlock": {
      const locked = action === "lock";
      await db.update(rooms).set({ locked }).where(eq(rooms.id, room.id));

      await announceToRoom(room.livekitRoom, {
        type: "moderation",
        action,
        name: "",
      });
      return NextResponse.json({ ok: true, locked });
    }

    default:
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }
}

/**
 * Mute one source belonging to one participant.
 *
 * A participant can publish more than one track of a source in odd cases, so
 * every match is muted rather than the first. Already-muted tracks are skipped:
 * telling the media server to mute something twice is harmless, but the room
 * would be told about it twice too.
 */
async function muteSource(
  service: RoomServiceClient,
  livekitRoom: string,
  participant: { identity: string; tracks: { sid: string; source: TrackSource; muted: boolean }[] },
  source: TrackSource,
) {
  const targets = participant.tracks.filter(
    (track) => track.source === source && !track.muted,
  );

  await Promise.all(
    targets.map((track) =>
      service.mutePublishedTrack(livekitRoom, participant.identity, track.sid, true),
    ),
  );
}
