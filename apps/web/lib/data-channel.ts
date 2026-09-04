/**
 * What participants say to each other that is not audio or video.
 *
 * Chat, reactions and raised hands all ride LiveKit's data channel. We run no
 * socket server of our own, which is what lets the same code run on serverless
 * and on a single self-hosted box — so every message in the meeting has to fit
 * through here.
 *
 * Two rules make this survivable as the protocol grows:
 *
 * 1. **The sender is never in the payload.** Attribution comes from the
 *    participant LiveKit hands to the `DataReceived` handler, which is signed by
 *    the media server. A `from` field on the wire would be a name anyone in the
 *    room could put on anyone else's message.
 * 2. **Anything unrecognised is dropped, never thrown.** A client one release
 *    ahead will send types this one has never heard of. That must be quiet, not
 *    a crash in the middle of somebody's meeting.
 */

/**
 * Bumped only for a breaking change to an existing message.
 *
 * Adding a new `type` is not breaking: older clients already ignore what they do
 * not recognise, so the version stays where it is.
 */
export const PROTOCOL_VERSION = 1;

/**
 * Namespaces our packets on the channel.
 *
 * LiveKit delivers every data packet in the room to every subscriber. A topic
 * means a future feature — or another tool sharing the room — can publish
 * without this decoder having to guess whether the bytes were meant for it.
 */
export const DATA_TOPIC = "lor";

/**
 * Packets our own backend puts into the room.
 *
 * A separate topic because they are trusted differently, and the difference has
 * to be checkable. LiveKit reports no sending participant for a server packet
 * and always reports one for a peer's, so the rule is exact: a notice counts
 * only when it arrives on this topic *and* nobody is named as its sender. A
 * participant publishing here is named, and is therefore ignored.
 */
export const SERVER_TOPIC = "lor-server";

/**
 * What the backend has to say. Never data — only "something changed, go and
 * look", so a forged one could at worst cause a fetch the sender is already
 * allowed to make.
 */
export type ServerNotice = { type: "knock" };

export function encodeServerNotice(notice: ServerNotice): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(
    JSON.stringify({ v: PROTOCOL_VERSION, ...notice }),
  );
}

export function decodeServerNotice(payload: Uint8Array): ServerNotice | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(payload));
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const envelope = parsed as Envelope;
  if (envelope.v !== PROTOCOL_VERSION) return null;

  return envelope.type === "knock" ? { type: "knock" } : null;
}

/**
 * Long enough for a pasted stack trace, short enough to stay well inside
 * LiveKit's ~15 KB packet limit once the text is UTF-8 encoded.
 */
export const MAX_CHAT_LENGTH = 2000;

/**
 * The reactions anyone may send.
 *
 * A closed list, not free text. The overlay draws whatever arrives on top of
 * everybody's video, so an open field would let one participant paint a sentence
 * across the meeting. Six is as many as fit in a row without a scroll.
 */
export const REACTIONS = [
  "\u{1F44D}",
  "\u2764\uFE0F",
  "\u{1F602}",
  "\u{1F389}",
  "\u{1F44F}",
  "\u{1F62E}",
] as const;
export type Reaction = (typeof REACTIONS)[number];

/**
 * How stale a re-announced hand may claim to be.
 *
 * Twelve hours is far longer than any meeting and far shorter than a value that
 * would sort a hand before the epoch.
 */
export const MAX_HAND_AGE_MS = 12 * 60 * 60 * 1000;

export type RoomMessage =
  | { type: "chat"; id: string; body: string }
  | { type: "reaction"; id: string; emoji: Reaction }
  | {
      type: "hand";
      raised: boolean;
      /**
       * How long ago the sender raised it, in milliseconds.
       *
       * A duration rather than a timestamp, and that is the whole point: the
       * queue has to be in the order hands went up, and the senders' clocks
       * disagree by minutes. A duration measured on one clock and subtracted
       * from another stays correct — only the two clocks' *rates* would have to
       * differ for it to drift, and they do not.
       *
       * Zero when a hand goes up; non-zero only when an existing hand is
       * re-announced to somebody who has just joined.
       */
      sinceMs: number;
    };

/** The wire form. Short-lived, so it is versioned rather than migrated. */
interface Envelope {
  v: number;
  type: string;
  [key: string]: unknown;
}

// The buffer type is spelled out because LiveKit's `publishData` wants a view
// over a plain ArrayBuffer, and a bare `Uint8Array` widens to one that might be
// backed by a SharedArrayBuffer.
export function encodeMessage(message: RoomMessage): Uint8Array<ArrayBuffer> {
  const envelope: Envelope = { v: PROTOCOL_VERSION, ...message };
  return new TextEncoder().encode(JSON.stringify(envelope));
}

/**
 * Turn received bytes into a message, or into nothing.
 *
 * Every failure path returns `null`. Malformed JSON, a truncated packet, a type
 * from a newer client, a chat body that is not a string: none of them are worth
 * interrupting a call over, and all of them are reachable from a peer we do not
 * control.
 */
export function decodeMessage(payload: Uint8Array): RoomMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(payload));
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const envelope = parsed as Envelope;

  // A different major version may have redefined the fields under a type name
  // we recognise, so the version is checked before the type, not after.
  if (envelope.v !== PROTOCOL_VERSION) return null;

  switch (envelope.type) {
    case "chat": {
      const { id, body } = envelope;
      if (typeof id !== "string" || !id) return null;
      if (typeof body !== "string") return null;

      // Trim before measuring: a peer padding a message to the limit with
      // whitespace should not get a longer message than anyone else.
      const trimmed = body.trim();
      if (!trimmed) return null;

      return { type: "chat", id, body: trimmed.slice(0, MAX_CHAT_LENGTH) };
    }
    case "reaction": {
      const { id, emoji } = envelope;
      if (typeof id !== "string" || !id) return null;
      // Membership, not a shape test. Anything not on the list is not drawn.
      if (!isReaction(emoji)) return null;

      return { type: "reaction", id, emoji };
    }

    case "hand": {
      const { raised, sinceMs } = envelope;
      if (typeof raised !== "boolean") return null;

      // Absent from a client that predates re-announcing: treat it as just now,
      // which is what a hand message meant before the field existed.
      const age =
        typeof sinceMs === "number" && Number.isFinite(sinceMs) && sinceMs > 0
          ? Math.min(sinceMs, MAX_HAND_AGE_MS)
          : 0;

      return { type: "hand", raised, sinceMs: age };
    }

    default:
      // A type from a client one release ahead. Ignored on purpose.
      return null;
  }
}

/**
 * An id for one message, unique within this browser.
 *
 * Combined with the sender's identity by the receiver, this is what keys the
 * list. It is deliberately not trusted for anything else — a peer is free to
 * repeat one, and the worst that does is collide with its own earlier message.
 */
export function messageId(): string {
  return crypto.randomUUID();
}

function isReaction(value: unknown): value is Reaction {
  return (
    typeof value === "string" && (REACTIONS as readonly string[]).includes(value)
  );
}
