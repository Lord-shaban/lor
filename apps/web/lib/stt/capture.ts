"use client";

import { AudioRing } from "./audio-ring";
import {
  DEFAULT_VAD,
  createVadState,
  flush,
  levelDb,
  observeFrame,
  type VadSettings,
  type VadState,
} from "./vad";
import { SAMPLE_RATE, encodeWav } from "./wav";

/**
 * A microphone track in, one utterance at a time out.
 *
 * The three pieces this joins are each testable on their own and this is the
 * part that is not: `vad.ts` decides where an utterance begins and ends,
 * `audio-ring.ts` still has the audio from before the beginning was noticed,
 * and `wav.ts` turns a span of it into a file. Everything here is plumbing, and
 * it is deliberately thin for that reason.
 *
 * Nothing leaves this module. It produces spans; sending them anywhere is #85's
 * problem, and whether to capture at all is #89's.
 */

/** How much of the recent past to keep, so a long utterance is still whole. */
const RING_HEADROOM_MS = 5_000;

export interface Utterance {
  /** `audio/wav`, mono, at whatever rate the context actually gave us. */
  audio: Blob;
  fromMs: number;
  toMs: number;
  /** `silence` is a sentence; `limit` is a cut; `stop` is capture ending. */
  reason: "silence" | "limit" | "stop";
}

export interface Skipped {
  /** `short` was a cough or a chair. `gone` means the ring had overwritten it. */
  reason: "short" | "gone";
  fromMs: number;
  toMs: number;
}

export interface CaptureOptions {
  settings?: VadSettings;
  /**
   * Told about audio that was detected and then not sent.
   *
   * Reported rather than swallowed: a detector that silently discards is
   * indistinguishable from a microphone that is not working, and the two have
   * very different fixes.
   */
  onSkipped?: (skipped: Skipped) => void;
}

export interface Capture {
  /** Ends the current utterance, if any, then tears everything down. */
  stop: () => Promise<void>;
  /** What the context actually gave us, which may not be what we asked for. */
  sampleRate: number;
}

export async function startCapture(
  track: MediaStreamTrack,
  onUtterance: (utterance: Utterance) => void,
  options: CaptureOptions = {},
): Promise<Capture> {
  const settings = options.settings ?? DEFAULT_VAD;
  const context = openContext();

  // Autoplay policy suspends a context created before a gesture. Joining a call
  // is a gesture, but a reconnect is not.
  if (context.state === "suspended") await context.resume();

  await context.audioWorklet.addModule("/stt-worklet.js");

  const ring = new AudioRing(
    context.sampleRate,
    settings.maxUtteranceMs + settings.prerollMs + RING_HEADROOM_MS,
  );

  const source = context.createMediaStreamSource(new MediaStream([track]));
  const node = new AudioWorkletNode(context, "lor-capture");

  // A worklet is only pulled by the graph if it reaches the destination, and
  // the destination is the speakers. The processor writes nothing, so its
  // output is already silence — the zero gain is there so that stays true if
  // it ever writes something, rather than putting the microphone into the room.
  const silence = context.createGain();
  silence.gain.value = 0;

  source.connect(node);
  node.connect(silence);
  silence.connect(context.destination);

  let vad: VadState = createVadState();

  const emit = (fromMs: number, toMs: number, reason: Utterance["reason"]) => {
    const samples = ring.read(fromMs, toMs);
    if (!samples) {
      options.onSkipped?.({ reason: "gone", fromMs, toMs });
      return;
    }

    onUtterance({
      audio: new Blob([encodeWav(samples, context.sampleRate)], {
        type: "audio/wav",
      }),
      fromMs,
      toMs,
      reason,
    });
  };

  node.port.onmessage = (event: MessageEvent<Float32Array>) => {
    const frame = event.data;
    ring.write(frame);

    // The end of the frame, not its start: the level describes all of it, so
    // the last voiced moment should include the audio that made it voiced.
    const step = observeFrame(
      vad,
      { atMs: ring.writtenMs, db: levelDb(frame) },
      settings,
    );
    vad = step.state;

    const boundary = step.event;
    if (!boundary) return;

    if (boundary.type === "end") {
      emit(boundary.fromMs, boundary.toMs, boundary.reason);
    } else if (boundary.type === "drop") {
      options.onSkipped?.({
        reason: "short",
        fromMs: boundary.fromMs,
        toMs: boundary.toMs,
      });
    }
  };

  return {
    sampleRate: context.sampleRate,
    stop: async () => {
      node.port.onmessage = null;

      // Whatever was being said when capture stopped. Often the thing worth
      // keeping, and it has no trailing silence to close it.
      const last = flush(vad, ring.writtenMs, settings);
      vad = last.state;
      if (last.event?.type === "end") {
        emit(last.event.fromMs, last.event.toMs, "stop");
      } else if (last.event?.type === "drop") {
        options.onSkipped?.({
          reason: "short",
          fromMs: last.event.fromMs,
          toMs: last.event.toMs,
        });
      }

      source.disconnect();
      node.disconnect();
      silence.disconnect();
      await context.close();
    },
  };
}

/**
 * Sixteen kilohertz if the browser will give it to us.
 *
 * It is what every transcription model resamples to anyway, so asking for it
 * moves the resampling into the audio thread and out of our own code. Safari
 * has historically refused a rate that is not the hardware's, which is not an
 * error — the rate travels with the audio, into the ring and into the WAV
 * header, and a provider is happy with either.
 */
function openContext(): AudioContext {
  try {
    return new AudioContext({ sampleRate: SAMPLE_RATE });
  } catch {
    return new AudioContext();
  }
}
