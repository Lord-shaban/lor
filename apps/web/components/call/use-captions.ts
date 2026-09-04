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
import { listKeys, loadKey } from "@/lib/keys/store";
import { chooseRoute, type Route } from "@/lib/stt/route-choice";
import { buildPrompt } from "@/lib/stt/prompt";
import { applyRepairs, type Repair } from "@/lib/stt/repair";
import { transcribe } from "@/lib/stt/transcribe";
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
  /**
   * Whether the room is keeping what is said after the meeting.
   *
   * Separate from `on`, and announced separately: agreeing that words may be
   * on a screen for a few seconds is not agreeing that they are written down.
   */
  keeping: boolean;
  toggleKeeping: () => void;
  log: CaptionLog;
  /** Null until something has actually been attempted. */
  error: "no_key" | "quota" | "rate_limited" | "failed" | null;
  /**
   * How much free allowance is left, once it is worth mentioning.
   *
   * Absent until the server says so — it only reports this near the end, so a
   * room is told in time to do something about it rather than nagged from the
   * first minute.
   */
  quota: { scope: "user" | "room" | "global"; remaining: number } | null;
  available: boolean;
  toggle: () => void;
  setSharing: (sharing: boolean) => void;
  /**
   * Try again after something changed — a key was added, most likely.
   *
   * Needed because a refusal that will not change on its own stops the capture
   * rather than retrying into it, so something has to say when the situation is
   * different.
   */
  retry: () => void;
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
  const [keeping, setKeeping] = useState(false);
  const [log, setLog] = useState<CaptionLog>(createCaptionLog);
  const [error, setError] = useState<Captions["error"]>(null);
  const [quota, setQuota] = useState<Captions["quota"]>(null);

  /**
   * Set when the answer will be the same until somebody does something.
   *
   * An exhausted allowance lasts until midnight and a missing key lasts until
   * one is added, so retrying every utterance is a request a second that cannot
   * succeed — seen in a probe as fifteen consecutive 429s in seventy-five
   * seconds. Capture stops instead; the notice already says why, and the way
   * out is the button next to it.
   */
  const [blocked, setBlocked] = useState(false);

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

      if (message.type === "keeping") {
        setKeeping(message.on);
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
      // Both, and separately. Somebody arriving into a room that is keeping a
      // record has to be told that, not left to infer it from captions being on.
      if (keeping) publish({ type: "keeping", on: true }, [participant.identity]);
    }

    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantConnected, onJoin);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantConnected, onJoin);
    };
  }, [room, on, keeping, publish, locale]);

  const retry = useCallback(() => {
    setBlocked(false);
    setError(null);
  }, []);

  const toggleKeeping = useCallback(() => {
    setKeeping((current) => {
      const next = !current;
      publish({ type: "keeping", on: next });
      return next;
    });
  }, [publish]);

  const toggle = useCallback(() => {
    // Switching captions off and on again is the other way somebody expresses
    // "try again", and it should not need explaining.
    setBlocked(false);
    setError(null);
    setOn((current) => {
      const next = !current;
      publish({ type: "captions", on: next });
      return next;
    });
  }, [publish]);

  // Capture, transcribe, publish. Only while captions are on and only while
  // this participant is willing to have their own microphone transcribed.
  useEffect(() => {
    if (!enabled || !on || !sharing || blocked) return;

    const track = microphoneTrack?.track?.mediaStreamTrack;
    if (!track) return;

    let capture: Capture | null = null;
    let speech: SpeechSource | null = null;
    let open: { id: string; atMs: number } | null = null;
    let stopped = false;

    /**
     * Which way this participant's audio goes, decided once when captions
     * start rather than per utterance.
     *
     * Their own key at a provider a browser can reach means neither the key nor
     * the audio touches our server — and it also means the prompt and the
     * repair pass have to be applied here, because the route that normally
     * applies them is the one being skipped. Both are pure functions; the room
     * supplies the words.
     */
    let route: Route = { kind: "proxy" };
    let prompt = buildPrompt();
    let repairs: Repair[] = [];

    const transcribeDirect = async (audio: Blob) => {
      if (route.kind !== "direct") return null;
      const result = await transcribe({
        audio,
        provider: route.provider,
        key: route.key,
        prompt,
      });
      return result.ok ? applyRepairs(result.text, repairs) : null;
    };

    void (async () => {
      try {
        const held = await listKeys().catch(() => []);
        const withKeys = await Promise.all(
          held.map(async (entry) => ({
            provider: entry.provider,
            key: (await loadKey(entry.provider)) ?? "",
          })),
        );
        route = chooseRoute(withKeys);

        if (route.kind === "direct") {
          // Only needed on the direct path. Failing to fetch them is not worth
          // stopping over: the prompt falls back to its shape and the repair
          // pass to doing nothing, which is worse captions rather than none.
          const [glossary, corrections] = await Promise.all([
            fetch(`/api/rooms/${code}/glossary`)
              .then((r) => (r.ok ? r.json() : { terms: [] }))
              .catch(() => ({ terms: [] })),
            fetch(`/api/rooms/${code}/repairs`)
              .then((r) => (r.ok ? r.json() : { repairs: [] }))
              .catch(() => ({ repairs: [] })),
          ]);
          prompt = buildPrompt(glossary.terms ?? []);
          repairs = corrections.repairs ?? [];
        }
      } catch {
        // No stored key, or storage refused. The proxy path is the default and
        // needs nothing.
      }

      try {
        capture = await startCapture(
          track,
          async (utterance) => {
            const id = utterance.id;
            const form = new FormData();
            form.set("audio", utterance.audio, "utterance.wav");
            form.set("room", code);

            try {
              // Straight to the provider, when their key and that provider
              // allow it. Nothing about this request exists on our side.
              if (route.kind === "direct") {
                const direct = await transcribeDirect(utterance.audio);
                if (direct) {
                  setError(null);
                  mine(id, utterance.fromMs, direct, true);
                } else {
                  setError("failed");
                  setLog((current) => abandon(current, id));
                }
                return;
              }

              const response = await fetch("/api/stt", {
                method: "POST",
                body: form,
                // Their key, on the one request that uses it. Never a query
                // parameter: those reach access logs, referrers and history.
                headers: route.key ? { "x-lor-stt-key": route.key } : undefined,
              });
              if (!response.ok) {
                const body = (await response.json().catch(() => null)) as
                  | { error?: string }
                  | null;
                if (body?.error === "quota" || body?.error === "no_key") {
                  setBlocked(true);
                }
                setError(
                  body?.error === "no_key"
                    ? "no_key"
                    : // The allowance ran out, which is not the same as too
                      // many requests: one is answered by a key and the other
                      // by waiting, and telling somebody to wait when they
                      // need a key wastes their meeting.
                      body?.error === "quota"
                      ? "quota"
                      : response.status === 429
                        ? "rate_limited"
                        : "failed",
                );
                // Nothing is coming for this line, and a guess left on screen
                // forever is worse than a line that never appeared.
                setLog((current) => abandon(current, id));
                return;
              }

              const payload = (await response.json()) as {
                text?: string;
                quota?: { scope: "user" | "room" | "global"; remaining: number };
              };
              const text = payload.text;
              setError(null);
              setQuota(payload.quota ?? null);

              // Only what settled, and only once the room said to keep it. The
              // fast pass never reaches here — a guess is a preview, and a
              // preview does not become a record.
              if (keeping && typeof text === "string" && text.trim()) {
                void fetch(`/api/rooms/${code}/transcript`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    text,
                    speaker: localParticipant.name || localParticipant.identity,
                    identity: localParticipant.identity,
                  }),
                }).catch(() => {
                  // A line that failed to store is a gap in the record, not a
                  // reason to interrupt the meeting. The caption still showed.
                });
              }
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
  }, [enabled, on, sharing, blocked, keeping, microphoneTrack, localParticipant, code, mine, locale]);

  return {
    on,
    sharing,
    log,
    error,
    quota,
    available: enabled,
    keeping,
    toggleKeeping,
    toggle,
    setSharing,
    retry,
  };
}

/** Whether the fast pass exists here. Used only to explain the latency. */
export { speechAvailable };
