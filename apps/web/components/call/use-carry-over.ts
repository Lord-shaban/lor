"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { ConnectionState, RoomEvent } from "livekit-client";

export type CarryOverState =
  | { state: "idle"; count: 0 }
  | { state: "ready"; count: number }
  | { state: "failed"; count: 0 };

/**
 * Ask for prior open work only after LiveKit says this browser is connected.
 *
 * The token response carries the occurrence id minted by the server. It is not
 * recreated here, and a reconnect to the same room never repeats the request
 * or presents work opened in the current occurrence as carry-over. When the
 * server cannot authoritatively observe LiveKit presence, there is no safe
 * occurrence to query and the call simply continues without this reminder.
 */
export function useCarryOver({
  code,
  meetingId,
}: {
  code: string;
  meetingId: string | null;
}) {
  const room = useRoomContext();
  const [carryOver, setCarryOver] = useState<CarryOverState>({
    state: "idle",
    count: 0,
  });
  const [attempt, setAttempt] = useState(0);
  const requested = useRef<string | null>(null);

  useEffect(() => {
    // Hold a non-null value for the nested async function. The prop can change
    // between scheduling and fetching, but this request remains scoped to the
    // occurrence that scheduled it and is aborted by the effect cleanup.
    if (!meetingId) return;
    const activeMeetingId = meetingId;

    const requestKey = `${activeMeetingId}:${attempt}`;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    async function load() {
      if (requested.current === requestKey || disposed) return;
      requested.current = requestKey;

      try {
        const response = await fetch(
          `/api/rooms/${code}/action-items/carry-over?meeting=${encodeURIComponent(activeMeetingId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error("Could not load carry-over action items");
        const body = await response.json() as { count?: unknown };
        const count = typeof body.count === "number" && body.count > 0
          ? Math.floor(body.count)
          : 0;
        if (!disposed) setCarryOver({ state: "ready", count });
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === "AbortError")) {
          setCarryOver({ state: "failed", count: 0 });
        }
      }
    }

    function schedule() {
      if (requested.current === requestKey || timer !== undefined) return;
      // Let the connected room paint and decode media before this background
      // record check begins. The notice is useful, but never call-critical.
      timer = setTimeout(() => {
        timer = undefined;
        void load();
      }, 0);
    }

    if (room.state === ConnectionState.Connected) schedule();
    room.on(RoomEvent.Connected, schedule);
    return () => {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      controller.abort();
      room.off(RoomEvent.Connected, schedule);
    };
  }, [attempt, code, meetingId, room]);

  const retry = useCallback(() => {
    requested.current = null;
    setCarryOver({ state: "idle", count: 0 });
    setAttempt((current) => current + 1);
  }, []);

  return { carryOver, retry };
}
