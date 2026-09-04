"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { RoomEvent, type RemoteParticipant } from "livekit-client";
import { appendEntry, type ChatEntry } from "@/lib/chat-log";
import {
  DATA_TOPIC,
  MAX_CHAT_LENGTH,
  decodeMessage,
  encodeMessage,
  messageId,
} from "@/lib/data-channel";

/**
 * The room's chat, over the data channel and nowhere else.
 *
 * Order comes for free: LiveKit's reliable channel preserves order per sender,
 * and a local message is appended only once the server has taken it, so what
 * you see is what the room saw.
 *
 * Nothing is stored. Someone joining halfway through a meeting starts with an
 * empty log — the panel says so rather than letting them assume the silence
 * means nobody has spoken.
 */
export function useRoomMessages() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const [entries, setEntries] = useState<ChatEntry[]>([]);
  // A running total of what arrived from other people. Separate from the log's
  // length, which stops growing once the log is full, so the unread badge does
  // not start counting backwards an hour into a call.
  const [received, setReceived] = useState(0);

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

      if (message.type === "chat") {
        setEntries((current) =>
          appendEntry(current, {
            // The sender's id is only unique to the sender, so the identity —
            // which the media server vouches for — is what makes the key.
            key: `${participant.identity}:${message.id}`,
            identity: participant.identity,
            name: participant.name || participant.identity,
            body: message.body,
            at: Date.now(),
            mine: false,
          }),
        );
        setReceived((count) => count + 1);
      }
    }

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

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

  return { entries, received, sendChat };
}
