import "server-only";
import { DataPacket_Kind, RoomServiceClient } from "livekit-server-sdk";
import { HOST_METADATA } from "@/lib/livekit";
import {
  SERVER_TOPIC,
  encodeServerNotice,
  type ServerNotice,
} from "@/lib/data-channel";

/**
 * Tell the host something happened, without either side holding a socket open.
 *
 * The alternative was a host who polls: a query every few seconds for every
 * meeting that has a door, almost all of them returning the same empty list.
 * Pushing turns that into one packet at the moment there is something to say.
 *
 * The notice carries no information — only "go and look". Everything about who
 * is waiting comes from the route that checks the host cookie, so the worst a
 * forged notice can do is cause a fetch its sender was already entitled to make.
 */

function client(): RoomServiceClient | null {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return null;

  // The service API is HTTP; the client URL is a WebSocket one.
  return new RoomServiceClient(url.replace(/^ws/, "http"), apiKey, apiSecret);
}

function isHost(metadata: string | undefined): boolean {
  if (!metadata) return false;
  if (metadata === HOST_METADATA) return true;
  try {
    return JSON.parse(metadata)?.host === true;
  } catch {
    return false;
  }
}

/**
 * Send a notice to the hosts in a room, and to nobody else.
 *
 * Addressed rather than broadcast. A contentless packet would be harmless to
 * overhear, but "somebody is at the door" is still news about a person who has
 * not been let in, and the guests already inside have no business knowing it.
 *
 * Never throws. A meeting must not fail to admit somebody because a
 * notification could not be delivered — the host's list is refetched on a slow
 * timer as well, which is what makes this an optimisation rather than a
 * dependency.
 */
export async function notifyHosts(
  livekitRoom: string,
  notice: ServerNotice,
): Promise<void> {
  const service = client();
  if (!service) return;

  try {
    const participants = await service.listParticipants(livekitRoom);
    const hosts = participants
      .filter((participant) => isHost(participant.metadata))
      .map((participant) => participant.identity);

    // Nobody to tell. The knock is already stored, so whoever arrives next
    // finds it in the list.
    if (hosts.length === 0) return;

    await service.sendData(
      livekitRoom,
      encodeServerNotice(notice),
      DataPacket_Kind.RELIABLE,
      { destinationIdentities: hosts, topic: SERVER_TOPIC },
    );
  } catch {
    // Deliberately silent. See above.
  }
}
