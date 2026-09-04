"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import {
  RoomEvent,
  type LocalParticipant,
  type RemoteParticipant,
} from "livekit-client";
import { appendEntry, type ChatEntry } from "@/lib/chat-log";
import {
  DATA_TOPIC,
  MAX_CHAT_LENGTH,
  decodeMessage,
  encodeMessage,
  messageId,
  type Reaction,
  type RoomMessage,
} from "@/lib/data-channel";
import { applyHand, pruneHands, type RaisedHand } from "@/lib/hand-queue";

/** How long a reaction stays on screen. Long enough to read, short enough to ignore. */
export const REACTION_LIFETIME_MS = 3000;

/**
 * A ceiling on how many reactions can be on screen at once.
 *
 * Not a rate limit — one participant holding a button down is a nuisance rather
 * than an attack — but it stops a burst from putting a hundred elements over
 * everybody's video.
 */
const MAX_VISIBLE_REACTIONS = 24;

/**
 * Publish, and accept that it might not go anywhere.
 *
 * `publishData` rejects when the engine is closed — mid-reconnect, or in the
 * moment after somebody leaves. For a reaction or a hand that is not worth
 * interrupting anyone over; what it must not become is an unhandled rejection,
 * which is exactly what it was until a headless browser raised a hand into a
 * closed connection and put "cannot negotiate on closed engine" on screen.
 *
 * Chat deliberately does not go through here: a chat message that silently
 * failed is a lost conversation, so `sendChat` lets the rejection reach the
 * composer.
 */
function publishQuietly(
  participant: LocalParticipant,
  message: RoomMessage,
  destinationIdentities?: string[],
) {
  participant
    .publishData(encodeMessage(message), {
      reliable: true,
      topic: DATA_TOPIC,
      destinationIdentities,
    })
    .catch(() => {
      // Nothing to do and nobody to tell.
    });
}

export interface FloatingReaction {
  key: string;
  emoji: Reaction;
  /** Who sent it. Not drawn — read out, so the overlay is not silent to a
      screen reader. */
  name: string;
  /** Stable per reaction, so it does not jump when the list re-renders. */
  offset: number;
}

/**
 * Everything participants say to each other that is not audio or video.
 *
 * Chat, reactions and raised hands share one data-channel listener and one
 * envelope. Order comes for free: LiveKit's reliable channel preserves order
 * per sender, and a local message is appended only once the server has taken
 * it, so what you see is what the room saw.
 *
 * Nothing is stored. Chat starts empty for anyone joining late — but a raised
 * hand is current state rather than history, so it is re-announced to each
 * arrival and reconstructed in the right order from its age.
 */
export function useRoomMessages() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const [entries, setEntries] = useState<ChatEntry[]>([]);
  // A running total of what arrived from other people. Separate from the log's
  // length, which stops growing once the log is full, so the unread badge does
  // not start counting backwards an hour into a call.
  const [received, setReceived] = useState(0);

  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [hands, setHands] = useState<RaisedHand[]>([]);

  // When this participant's own hand went up, on this clock. The announcement
  // sent to somebody who joins later is a duration measured from here.
  const raisedAtRef = useRef<number | null>(null);

  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const showReaction = useCallback(
    (key: string, emoji: Reaction, name: string) => {
    setReactions((current) =>
      [
        ...current,
        // Spread across the width so two at once do not sit on top of each
        // other. Chosen once, here, rather than during render — a render is
        // allowed to happen twice and the emoji must not teleport.
        { key, emoji, name, offset: Math.random() },
      ].slice(-MAX_VISIBLE_REACTIONS),
    );

      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        setReactions((current) => current.filter((item) => item.key !== key));
      }, REACTION_LIFETIME_MS);
      timersRef.current.add(timer);
    },
    [],
  );

  useEffect(() => {
    function onData(
      payload: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string,
    ) {
      // Someone else's feature, or a future one of ours.
      if (topic !== DATA_TOPIC) return;

      // No participant means the packet came from a server-side API rather than
      // from anybody in the room. There is nobody to attribute it to, and an
      // unattributed message in a meeting is worse than a missing one.
      if (!participant) return;

      const message = decodeMessage(payload);
      if (!message) return;

      const name = participant.name || participant.identity;

      switch (message.type) {
        case "chat":
          setEntries((current) =>
            appendEntry(current, {
              // The sender's id is only unique to the sender, so the identity —
              // which the media server vouches for — is what makes the key.
              key: `${participant.identity}:${message.id}`,
              identity: participant.identity,
              name,
              body: message.body,
              at: Date.now(),
              mine: false,
            }),
          );
          setReceived((count) => count + 1);
          return;

        case "reaction":
          showReaction(
            `${participant.identity}:${message.id}`,
            message.emoji,
            name,
          );
          return;

        case "hand":
          setHands((queue) =>
            applyHand(queue, {
              identity: participant.identity,
              name,
              raised: message.raised,
              // The sender's clock is not ours, so the age is subtracted from
              // local time rather than trusting a timestamp off the wire.
              at: Date.now() - message.sinceMs,
            }),
          );
          return;
      }
    }

    /**
     * Tell an arrival that this hand is already up.
     *
     * Chat is history and stays gone, but a raised hand is current state: to
     * somebody who has just joined, a hand nobody re-announces has silently
     * gone down. Addressed to the one participant, so a room of twenty does not
     * get twenty broadcasts every time somebody joins.
     */
    function onParticipantConnected(participant: RemoteParticipant) {
      announceHand([participant.identity]);
    }

    /**
     * Say it again after a blip.
     *
     * A hand raised while the connection was down never left this browser, and
     * anyone who joined during the gap heard nothing. Re-announcing is safe to
     * repeat: the queue keeps a hand where it already is rather than moving it
     * to the back.
     */
    function onReconnected() {
      announceHand();
    }

    function announceHand(to?: string[]) {
      const raisedAt = raisedAtRef.current;
      if (raisedAt === null) return;

      publishQuietly(
        localParticipant,
        {
          type: "hand",
          raised: true,
          sinceMs: Math.max(0, Date.now() - raisedAt),
        },
        to,
      );
    }

    /** A hand belonging to someone who has left is not a hand. */
    function onParticipantDisconnected(participant: RemoteParticipant) {
      const present = new Set<string>([
        localParticipant.identity,
        ...room.remoteParticipants.keys(),
      ]);
      // The event can arrive before the map is updated, so say it outright.
      present.delete(participant.identity);
      setHands((queue) => pruneHands(queue, present));
    }

    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.Reconnected, onReconnected);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.Reconnected, onReconnected);
    };
  }, [room, localParticipant, showReaction]);

  /**
   * Publish a message, then show it.
   *
   * That order is the point: if the room cannot be reached, this throws and the
   * composer keeps the text. Echoing first and publishing afterwards produces
   * the worst outcome a chat has — a message that looks sent and never was.
   */
  const sendChat = useCallback(
    async (raw: string) => {
      const body = raw.trim().slice(0, MAX_CHAT_LENGTH);
      if (!body) return;

      const id = messageId();
      await localParticipant.publishData(
        encodeMessage({ type: "chat", id, body }),
        { reliable: true, topic: DATA_TOPIC },
      );

      setEntries((current) =>
        appendEntry(current, {
          key: `${localParticipant.identity}:${id}`,
          identity: localParticipant.identity,
          name: localParticipant.name || localParticipant.identity,
          body,
          at: Date.now(),
          mine: true,
        }),
      );
    },
    [localParticipant],
  );

  /**
   * A reaction is shown locally first.
   *
   * The opposite of chat, and for the opposite reason: a reaction is a gesture,
   * so the feedback has to be immediate, and one that never left the room costs
   * nothing. A chat message that silently failed costs a conversation.
   */
  const sendReaction = useCallback(
    (emoji: Reaction) => {
      const id = messageId();
      showReaction(
        `${localParticipant.identity}:${id}`,
        emoji,
        localParticipant.name || localParticipant.identity,
      );
      publishQuietly(localParticipant, { type: "reaction", id, emoji });
    },
    [localParticipant, showReaction],
  );

  const handRaised = hands.some(
    (hand) => hand.identity === localParticipant.identity,
  );

  const toggleHand = useCallback(() => {
    const raised = raisedAtRef.current === null;
    const at = Date.now();
    raisedAtRef.current = raised ? at : null;

    setHands((queue) =>
      applyHand(queue, {
        identity: localParticipant.identity,
        name: localParticipant.name || localParticipant.identity,
        raised,
        at,
      }),
    );

    publishQuietly(localParticipant, { type: "hand", raised, sinceMs: 0 });
  }, [localParticipant]);

  return {
    entries,
    received,
    sendChat,
    reactions,
    sendReaction,
    hands,
    handRaised,
    toggleHand,
  };
}
