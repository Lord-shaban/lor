"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent, type RemoteParticipant } from "livekit-client";
import {
  SERVER_TOPIC,
  decodeServerNotice,
  type ModerationAction,
} from "@/lib/data-channel";

/** Long enough to read, short enough not to become part of the furniture. */
const ANNOUNCEMENT_MS = 6000;

export interface Announcement {
  key: string;
  action: ModerationAction;
  name: string;
}

/**
 * Moderation, and the fact that it happened.
 *
 * Every action is announced to the whole room, including to the person it was
 * done to. A microphone that goes off on its own is indistinguishable from one
 * that broke, and a host who can quietly silence people is a different product
 * from one who can silence them.
 *
 * The announcement arrives on the server topic with no sender, which is the
 * same rule the knock notice uses: peers are always named, so a participant
 * cannot announce a moderation that did not happen.
 */
export function useModeration({
  code,
  isHost,
}: {
  code: string;
  isHost: boolean;
}) {
  const room = useRoomContext();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    function onData(
      payload: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string,
    ) {
      if (topic !== SERVER_TOPIC) return;
      // A named sender means a participant published this, not our backend.
      if (participant) return;

      const notice = decodeServerNotice(payload);
      if (notice?.type !== "moderation") return;

      if (timerRef.current) clearTimeout(timerRef.current);
      setAnnouncement({
        // Keyed so an identical action twice still re-announces rather than
        // looking like the first one never cleared.
        key: `${Date.now()}`,
        action: notice.action,
        name: notice.name,
      });
      timerRef.current = setTimeout(
        () => setAnnouncement(null),
        ANNOUNCEMENT_MS,
      );
    }

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  /**
   * Ask the server to do it. The browser never asks a peer to mute itself: a
   * request a participant can ignore is not moderation.
   */
  const moderate = useCallback(
    async (action: ModerationAction, identity?: string) => {
      if (!isHost) return;
      try {
        await fetch(`/api/rooms/${code}/mod`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, identity }),
        });
      } catch {
        // The announcement is what confirms an action landed, so a failed
        // request simply produces no announcement.
      }
    },
    [code, isHost],
  );

  return { announcement, moderate, dismiss: () => setAnnouncement(null) };
}
