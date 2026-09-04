import "server-only";
import { RoomServiceClient } from "livekit-server-sdk";
import { HOST_METADATA } from "@/lib/livekit";

/**
 * Is there anyone in there who can open the door?
 *
 * Someone waiting for a host who left is the worst state this feature can put a
 * person in: nothing is broken, nothing is loading, and nothing will ever
 * happen. Telling them costs one call to the media server per poll and is the
 * difference between a wait and a dead end.
 *
 * Hosts are told apart by participant metadata, set when their token is minted.
 * LiveKit does not report a participant's grants, so `roomAdmin` — which is what
 * actually makes someone a host — cannot be read back from here.
 */

function client(): RoomServiceClient | null {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return null;

  // The service API is HTTP; the client URL is a WebSocket one.
  return new RoomServiceClient(
    url.replace(/^ws/, "http"),
    apiKey,
    apiSecret,
  );
}

/**
 * Whether a host is currently connected.
 *
 * `null` means the question could not be asked — no credentials, the media
 * server unreachable, a room that does not exist yet. That is deliberately not
 * `false`: announcing that the host left because our own call timed out would
 * be worse than saying nothing at all.
 */
export async function isHostPresent(
  livekitRoom: string,
): Promise<boolean | null> {
  const service = client();
  if (!service) return null;

  try {
    const participants = await service.listParticipants(livekitRoom);
    return participants.some((participant) => {
      if (!participant.metadata) return false;
      // Fast path for exactly what we write. The parse below is the real
      // check, so a future field added alongside `host` still matches.
      if (participant.metadata === HOST_METADATA) return true;
      try {
        return JSON.parse(participant.metadata)?.host === true;
      } catch {
        // Metadata is a free-form string. Anything we did not write is not a
        // host, and is certainly not worth throwing over.
        return false;
      }
    });
  } catch {
    return null;
  }
}
