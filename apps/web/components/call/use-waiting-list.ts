"use client";

import { useCallback, useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent, type RemoteParticipant } from "livekit-client";
import { SERVER_TOPIC, decodeServerNotice } from "@/lib/data-channel";

/**
 * How long to leave a missed notice undetected.
 *
 * The push is the mechanism; this is the floor under it. A host who joined a
 * second after somebody knocked, or whose packet was lost, must not be left
 * unaware indefinitely — but at thirty seconds this costs a room with a door
 * two queries a minute rather than the twenty a real poll would.
 */
const SAFETY_REFRESH_MS = 30_000;

export interface WaitingPerson {
  id: string;
  name: string;
  at: string;
}

/**
 * Who is at the door, for the host only.
 *
 * Driven by a notice from our own backend rather than by polling. The rule that
 * makes that safe is exact: a notice counts only when it arrives on the server
 * topic *and* LiveKit names no sender. Every peer packet has a sender, so a
 * participant cannot forge one — and even if they could, the notice says
 * nothing. It only causes a fetch, and that fetch is the thing that checks the
 * host cookie.
 */
export function useWaitingList({
  code,
  isHost,
}: {
  code: string;
  isHost: boolean;
}) {
  const room = useRoomContext();
  const [waiting, setWaiting] = useState<WaitingPerson[]>([]);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [doorOn, setDoorOn] = useState(false);
  const [locked, setLocked] = useState(false);

  const refresh = useCallback(async () => {
    if (!isHost) return;
    try {
      const response = await fetch(`/api/rooms/${code}/waiting`);
      if (!response.ok) return;
      const body = await response.json();
      setWaiting(Array.isArray(body.waiting) ? body.waiting : []);
      setDoorOn(body.waitingRoom === true);
      setLocked(body.locked === true);
    } catch {
      // Offline, or a request that died on the way. The next notice or the
      // safety refresh will pick it up; an empty list would be a lie.
    }
  }, [code, isHost]);

  useEffect(() => {
    if (!isHost) return;

    function onData(
      payload: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string,
    ) {
      if (topic !== SERVER_TOPIC) return;
      // A named sender means a participant published this, not our backend.
      if (participant) return;
      if (decodeServerNotice(payload)?.type !== "knock") return;
      void refresh();
    }

    room.on(RoomEvent.DataReceived, onData);

    // Scheduled rather than called. Somebody may already have been waiting
    // before this host arrived, so the list is fetched immediately — but from
    // a timer rather than from the effect's own body, because state set
    // synchronously there cascades another render before the first paint.
    let timer: ReturnType<typeof setTimeout>;
    function tick() {
      void refresh();
      timer = setTimeout(tick, SAFETY_REFRESH_MS);
    }
    timer = setTimeout(tick, 0);

    return () => {
      room.off(RoomEvent.DataReceived, onData);
      clearTimeout(timer);
    };
    // `refresh` is memoised on [code, isHost], both fixed for the life of a
    // call, so this subscribes once rather than on every render.
  }, [room, isHost, refresh]);

  const decide = useCallback(
    async (id: string, decision: "admit" | "deny") => {
      setDeciding(id);
      try {
        await fetch(`/api/rooms/${code}/waiting`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, decision }),
        });
      } catch {
        // Left in the list. A decision that did not reach the server must not
        // look like one that did.
      } finally {
        setDeciding(null);
        await refresh();
      }
    },
    [code, refresh],
  );

  /**
   * Turn the door on or off.
   *
   * Optimistic, and deliberately so: a switch that waits for a round trip
   * before moving reads as broken. The refresh afterwards is what makes it
   * honest — if the server disagreed, the switch goes back.
   */
  const setWaitingRoom = useCallback(
    async (enabled: boolean) => {
      setDoorOn(enabled);
      try {
        await fetch(`/api/rooms/${code}/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ waitingRoom: enabled }),
        });
      } catch {
        // Corrected by the refresh below.
      }
      await refresh();
    },
    [code, refresh],
  );

  /**
   * Lock or unlock the room.
   *
   * Through the moderation route rather than settings, because locking is
   * something done to the people who are not in the room yet, and everything
   * done to people is announced.
   */
  const setRoomLocked = useCallback(
    async (next: boolean) => {
      setLocked(next);
      try {
        await fetch(`/api/rooms/${code}/mod`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: next ? "lock" : "unlock" }),
        });
      } catch {
        // Corrected by the refresh below.
      }
      await refresh();
    },
    [code, refresh],
  );

  return {
    waiting,
    deciding,
    decide,
    refresh,
    doorOn,
    setWaitingRoom,
    locked,
    setRoomLocked,
  };
}
