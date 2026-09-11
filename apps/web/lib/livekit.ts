import "server-only";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

/**
 * Access tokens for the media server.
 *
 * A token is the only thing that admits anyone to a room, so this module is the
 * security boundary for the whole call. Nothing here may ever be imported from
 * a client component; `server-only` enforces that at build time.
 */

/**
 * One hour.
 *
 * The expiry is checked when joining and when reconnecting, not while
 * connected — an established session is not cut off mid-sentence. So this
 * bounds how long a leaked token is useful for rather than how long a meeting
 * can run, and the client re-mints on `Reconnecting` for calls that outlive it.
 */
const TOKEN_TTL_SECONDS = 60 * 60;

/**
 * Written into a host's access token so the media server reports it back.
 *
 * Public by nature — a host is visible in the room anyway — and never trusted
 * as a permission. It exists only so "is a host connected?" can be answered:
 * LiveKit does not report a participant's grants, so `roomAdmin`, which is what
 * actually confers host rights, cannot be read back from the service API.
 */
export const HOST_METADATA = JSON.stringify({ host: true });

export interface TokenGrant {
  /** LiveKit room name, which is not the public room code. */
  livekitRoom: string;
  /** Stable within a browser tab, so a reload rejoins as the same participant. */
  identity: string;
  /** What other participants see. Never trusted as identity. */
  displayName: string;
  /**
   * False for someone still in the waiting room: they may watch and hear, but
   * cannot turn anything on until the host admits them.
   */
  canPublish: boolean;
  /** Room-wide moderation is granted only to a verified host. */
  isHost: boolean;
}

function requireCredentials() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "LIVEKIT_API_KEY and LIVEKIT_API_SECRET must both be set. " +
        "Get them from your LiveKit project settings.",
    );
  }

  return { apiKey, apiSecret };
}

/**
 * The service API uses HTTP while browsers connect to LiveKit over WebSocket.
 * Keeping this conversion server-only means neither API secret nor service
 * endpoint behaviour leaks into the client bundle.
 */
function livekitServiceUrl(): string {
  const value = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_LIVEKIT_URL is not set.");
  }

  const url = new URL(value);
  if (url.protocol === "ws:") url.protocol = "http:";
  if (url.protocol === "wss:") url.protocol = "https:";
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_LIVEKIT_URL must use ws, wss, http, or https.");
  }
  return url.toString();
}

/**
 * Ask LiveKit for authoritative presence before minting a token boundary.
 * A browser's local connection state is not a valid basis for recurring-meeting
 * lifecycle records because it can be stale, forged, or disconnected.
 */
export async function roomIsEmpty(livekitRoom: string): Promise<boolean> {
  const { apiKey, apiSecret } = requireCredentials();
  const service = new RoomServiceClient(livekitServiceUrl(), apiKey, apiSecret);
  return (await service.listParticipants(livekitRoom)).length === 0;
}

/**
 * Confirm that a caller's server-derived identity still has a seat in the live
 * room. Optional meeting actions can fail closed on a stale tab without making
 * a LiveKit service outage an admission failure.
 */
export async function participantIsInRoom(
  livekitRoom: string,
  identity: string,
): Promise<boolean> {
  const { apiKey, apiSecret } = requireCredentials();
  const service = new RoomServiceClient(livekitServiceUrl(), apiKey, apiSecret);
  return (await service.listParticipants(livekitRoom)).some(
    (participant) => participant.identity === identity,
  );
}

/**
 * A participant identity that cannot be guessed by another participant.
 *
 * LiveKit disconnects an existing participant when a second one joins with the
 * same identity, so a predictable identity is a way to kick somebody out of a
 * meeting. Deriving it from a secret the client keeps to itself closes that:
 * you can only take over a session you already are.
 *
 * The session id lives in the tab's own storage, so a reload keeps the identity
 * and a second tab gets a different one rather than evicting the first.
 */
export async function participantIdentity(
  livekitRoom: string,
  sessionId: string,
): Promise<string> {
  const salt = process.env.LIVEKIT_API_SECRET ?? "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${livekitRoom}:${salt}:${sessionId}`),
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `p_${hex.slice(0, 24)}`;
}

/** Mint a token for one participant in one room. */
export async function createAccessToken(grant: TokenGrant): Promise<string> {
  const { apiKey, apiSecret } = requireCredentials();

  const token = new AccessToken(apiKey, apiSecret, {
    identity: grant.identity,
    name: grant.displayName,
    ttl: TOKEN_TTL_SECONDS,

    // Marks the host in a way the media server will report back. Grants are not
    // readable through the service API, so `roomAdmin` — the thing that
    // actually confers host rights — cannot answer "is a host in the room?".
    // Nothing is trusted from here: this is a label for presence, never a
    // permission. Permissions are the grants below and the checks in the routes.
    ...(grant.isHost ? { metadata: HOST_METADATA } : {}),
  });

  token.addGrant({
    room: grant.livekitRoom,
    roomJoin: true,

    // Scoped to this one room. A token minted for room A carries no grant for
    // room B, so it cannot be replayed there.
    canPublish: grant.canPublish,
    canPublishData: true,
    canSubscribe: true,

    // Chat, reactions, captions, whiteboard and notes all ride the data
    // channel, so someone waiting for admission still needs to send data —
    // that is how they knock and how they are told they were admitted.
    canUpdateOwnMetadata: true,

    // Only a verified host may mute or remove anybody.
    roomAdmin: grant.isHost,
  });

  return token.toJwt();
}
