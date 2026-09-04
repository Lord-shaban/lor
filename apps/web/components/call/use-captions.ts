"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { RoomEvent, type RemoteParticipant } from "livekit-client";
import type { Direction } from "@/lib/bidi";
import {
  DATA_TOPIC,
  decodeMessage,
  encodeMessage,
  type RoomMessage,
} from "@/lib/data-channel";
import {
  abandon,
  createCaptionLog,
  provisional,
  settle,
  type CaptionLog,
} from "@/lib/stt/caption-log";
import { startCapture, type Capture } from "@/lib/stt/capture";
import { speechAvailable, startSpeech, type SpeechSource } from "@/lib/stt/speech";

/**
 * Captions, from the microphone to the strip.
 *
 * The shape of this is settled by one fact: **each participant transcribes only
 * their own microphone.** Nobody can cause somebody else's audio to be sent
 * anywhere; every client sends its own and publishes the text.
 *
 * That is also what makes the consent real rather than decorative. Turning
 * captions on is a room-wide switch, and switching it on causes *other people's*
 * audio to be transcribed — so it is announced on the data channel, the notice
 * stays up while it is on, and anybody can stop their own microphone being
 * transcribed without switching captions off for the room.
 *
 * Two passes fill each line, and `caption-log.ts` owns the rules about which
 * one wins. This hook only has to keep the fast one and the slow one pointed at
 * the same utterance id — which is why `startCapture` reports an onset as well
 * as a finished utterance.
 */

export interface Captions {
  /** On for the room. Announced, never inferred. */
  on: boolean;
  /** Whether this participant's own microphone is being transcribed. */
  sharing: boolean;
  log: CaptionLog;
  /** Null until something has actually been attempted. */
  error: "no_key" | "rate_limited" | "failed" | null;
  available: boolean;
  toggle: () => void;
  setSharing: (sharing: boolean) => void;
}

export function useCaptions({
  code,
  locale,
  enabled,
}: {
  code: string;
  locale: Direction;
  /** False before the call is joined, so nothing starts too early. */
  enabled: boolean;
}): Captions {
  const room = useRoomContext();
  const { localParticipant, microphoneTrack } = useLocalParticipant();

  const [on, setOn] = useState(false);
  const [sharing, setSharing] = useState(true);
  const [log, setLog] = useState<CaptionLog>(createCaptionLog);
  const [error, setError] = useState<Captions["error"]>(null);

  const publish = useCallback(
    (message: RoomMessage, to?: string[]) => {
      localParticipant
        .publishData(encodeMessage(message), {
          reliable: true,
          topic: DATA_TOPIC,
          destinationIdentities: to,
        })
        .catch(() => {
          // The engine is closed — mid-reconnect, or somebody just left. A
          // caption is not worth interrupting anyone over, and an uncaught
          // rejection here would put "cannot negotiate on closed engine" on
          // screen the way a raised hand once did.
        });
    },
    [localParticipant],
  );

  /** My own line, shown here and sent to everybody else. */
  const mine = useCallback(
    (id: string, atMs: number, text: string, final: boolean) => {
      const utterance = {
        id,
        speaker: localParticipant.name || localParticipant.identity,
        atMs,
      };

      setLog((current) =>
        final
          ? settle(current, utterance, text, locale)
          : provisional(current, utterance, text, locale),
      );
      publish({ type: "caption", id, text, final });
    },
    [localParticipant, publish, locale],
  );

  // Everybody else's lines, and the room-level switch.
  useEffect(() => {
    function onData(
      payload: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string,
    ) {
      if (topic !== DATA_TOPIC || !participant) return;

      const message = decodeMessage(payload);
      if (!message) return;

      if (message.type === "captions") {
        setOn(message.on);
        return;
      }

      if (message.type !== "caption") return;

      const utterance = {
        // The sender's id is unique only to the sender. The identity, which the
        // media server vouches for, is what makes it unique in the room — and
        // is why one participant cannot overwrite another's line.
        id: `${participant.identity}:${message.id}`,
        speaker: participant.name || participant.identity,
        atMs: Date.now(),
      };

      setLog((current) =>
        message.final
          ? settle(current, utterance, message.text, locale)
          : provisional(current, utterance, message.text, locale),
      );
    }

    /**
     * Tell an arrival that captions are already running.
     *
     * The same reason a raised hand is re-announced: to somebody who has just
     * joined, a notice nobody repeats never happened — and this is the notice
     * that says their microphone is being transcribed.
     */
    function onJoin(participant: RemoteParticipant) {
      if (on) publish({ type: "captions", on: true }, [participant.identity]);
    }

    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantConnected, onJoin);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantConnected, onJoin);
    };
  }, [room, on, publish, locale]);

  const toggle = useCallback(() => {
    setOn((current) => {
      const next = !current;
      publish({ type: "captions", on: next });
      return next;
    });
  }, [publish]);

  // Capture, transcribe, publish. Only while captions are on and only while
  // this participant is willing to have their own microphone transcribed.
  useEffect(() => {
    if (!enabled || !on || !sharing) return;

    const track = microphoneTrack?.track?.mediaStreamTrack;
    if (!track) return;

    let capture: Capture | null = null;
    let speech: SpeechSource | null = null;
    let open: { id: string; atMs: number } | null = null;
    let stopped = false;

    void (async () => {
      try {
        capture = await startCapture(
          track,
          async (utterance) => {
            const id = utterance.id;
            const form = new FormData();
            form.set("audio", utterance.audio, "utterance.wav");
            form.set("room", code);

            try {
              const response = await fetch("/api/stt", { method: "POST", body: form });
              if (!response.ok) {
                const body = (await response.json().catch(() => null)) as
                  | { error?: string }
                  | null;
                setError(
                  body?.error === "no_key"
                    ? "no_key"
                    : response.status === 429
                      ? "rate_limited"
                      : "failed",
                );
                // Nothing is coming for this line, and a guess left on screen
                // forever is worse than a line that never appeared.
                setLog((current) => abandon(current, id));
                return;
              }

              const { text } = (await response.json()) as { text?: string };
              setError(null);
              if (typeof text === "string" && text.trim()) {
                mine(id, utterance.fromMs, text, true);
              } else {
                setLog((current) => abandon(current, id));
              }
            } catch {
              setError("failed");
              setLog((current) => abandon(current, id));
            }
          },
          {
            onStart: (utterance) => {
              open = utterance;
            },
            onSkipped: ({ id }) => {
              if (open?.id === id) open = null;
              setLog((current) => abandon(current, id));
            },
          },
        );

        if (stopped) {
          await capture.stop();
          capture = null;
          return;
        }

        // The fast half. Absent in Firefox and behind a flag in Safari, in
        // which case captions are simply a little later.
        speech = startSpeech(
          (text) => {
            if (open) mine(open.id, open.atMs, text, false);
          },
          { lang: locale === "rtl" ? "ar-EG" : "en-US" },
        );
      } catch {
        setError("failed");
      }
    })();

    return () => {
      stopped = true;
      speech?.stop();
      // `.catch`, not `void`. Tearing down an audio graph that is already
      // closing rejects, and `void` catches nothing — the same shape as the
      // `publishData` rejection that once put "cannot negotiate on closed
      // engine" on screen. Here it fires on every unmount, so leaving somebody
      // in a call is the common path, not the rare one.
      void capture?.stop().catch(() => {});
    };
    // `microphoneTrack` rather than a lookup, and in the dependencies rather
    // than read once: without it this effect runs at the moment captions are
    // switched on, finds no track if the microphone has not finished
    // publishing, and returns — permanently, because nothing would ever run it
    // again. Captions would simply not work, with nothing on screen to say why.
    // Muting and unmuting republishes the track, so the same gap would also
    // have ended captions for good the first time somebody muted themselves.
  }, [enabled, on, sharing, microphoneTrack, localParticipant, code, mine, locale]);

  return {
    on,
    sharing,
    log,
    error,
    available: enabled,
    toggle,
    setSharing,
  };
}

/** Whether the fast pass exists here. Used only to explain the latency. */
export { speechAvailable };
