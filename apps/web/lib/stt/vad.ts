/**
 * Deciding where one utterance ends and the next begins.
 *
 * The obvious way to stream audio to a transcription service is to cut it every
 * five seconds and send the pieces. It is also the first thing that ruins the
 * output: five seconds lands in the middle of a word about as often as not, and
 * a model handed half a word does not return half a word — it returns a whole
 * different one, confidently. In a code-switched sentence that is worse still,
 * because a clipped English term is exactly the input that makes Whisper reach
 * for Arabic script.
 *
 * It is also most of the bill. Silence costs the same as speech when the chunks
 * are fixed, and a meeting is mostly silence from any one microphone.
 *
 * So the cut is made where the speaker stopped. This module holds only the
 * decision — energy in, boundaries out — with no audio API in sight, because
 * the decision is the part that is wrong in interesting ways and a pure
 * function is the only part of this that can be tested without a microphone.
 *
 * Four things it has to get right, each of which is a way of cutting a word in
 * half by accident:
 *
 *   pre-roll   an onset is always detected late; without audio kept from
 *              before it, every utterance loses its first consonant
 *   hangover   a stop consonant contains real silence. "deploy" has a gap in
 *              the middle of it, and ending an utterance there splits the word
 *   tail       the same at the end, where a final consonant trails off below
 *              the threshold before it has finished
 *   floor      a fixed threshold means a noisy room streams continuously and a
 *              quiet one never triggers. The bar moves with the room.
 */

export interface VadSettings {
  /** How far above the noise floor counts as somebody talking. */
  onsetDb: number;
  /**
   * And how far above it counts as still talking.
   *
   * Lower than `onsetDb` on purpose. One threshold makes the detector chatter
   * across it in the middle of a sentence, which is how a paragraph becomes
   * fourteen requests.
   */
  releaseDb: number;
  /** Quiet needed before an utterance is called finished. */
  hangoverMs: number;
  /** Audio kept from before the onset was noticed. */
  prerollMs: number;
  /** Audio kept after the last voiced frame. */
  tailMs: number;
  /** Below this, it was a cough or a chair, and sending it costs money. */
  minUtteranceMs: number;
  /**
   * Above this, cut anyway and keep going.
   *
   * Somebody presenting can talk for minutes without a gap long enough to be a
   * boundary, and a caption that arrives after the point has been made is not
   * a caption. The cut is mid-sentence, which is the cost of the guarantee.
   */
  maxUtteranceMs: number;
}

export const DEFAULT_VAD: VadSettings = {
  onsetDb: 9,
  releaseDb: 5,
  // Long enough to sit through a stop consonant, short enough that a reply
  // does not feel like it is waiting for permission.
  hangoverMs: 600,
  prerollMs: 300,
  tailMs: 200,
  minUtteranceMs: 250,
  maxUtteranceMs: 20_000,
};

export interface VadState {
  speaking: boolean;
  /** Rolling estimate of the room, in dBFS. */
  floorDb: number;
  /** Frames seen, until the floor has been primed. */
  frames: number;
  /** Whether the floor means anything yet. */
  primed: boolean;
  /** Where the current utterance starts, pre-roll already subtracted. */
  startedAtMs: number | null;
  /**
   * Where the voice itself started, before any padding.
   *
   * Kept apart from `startedAtMs` because the minimum length has to be measured
   * on what was said. Pre-roll and tail add half a second to every utterance,
   * so a minimum measured on the padded span would never drop anything and a
   * cough would be transcribed like a sentence.
   */
  voiceFromMs: number;
  /** The last frame that was above the release threshold. */
  lastVoiceMs: number;
  /** When the current run of quiet began, or null if the last frame was loud. */
  quietSinceMs: number | null;
}

/** A boundary the caller should act on. */
export type VadEvent =
  | { type: "start"; atMs: number }
  | {
      type: "end";
      fromMs: number;
      toMs: number;
      /** `silence` is a sentence. `limit` is a cut. `stop` is capture ending. */
      reason: "silence" | "limit" | "stop";
    }
  /** Too short to be speech. Reported rather than hidden, so it can be counted. */
  | { type: "drop"; fromMs: number; toMs: number };

/** Silence, in dBFS. Quieter than any microphone reports. */
const SILENT_DB = -100;

/**
 * How fast the floor follows the room.
 *
 * Downwards quickly, because a room that just went quiet is quiet now and the
 * detector should say so. Upwards slowly, because the thing making it louder is
 * usually the speech we are trying to measure against it — a fast rise lets a
 * long sentence drag the bar up over its own tail and cut itself short.
 */
const FLOOR_FALL = 0.35;
const FLOOR_RISE = 0.01;

/**
 * Frames spent listening to the room before making any decision.
 *
 * The floor is the quietest of them. If somebody happens to be talking through
 * all five, the floor comes out too high and the first utterance is missed —
 * which is why the floor falls quickly afterwards, and why this is five frames
 * and not fifty.
 */
const PRIME_FRAMES = 5;

export function createVadState(): VadState {
  return {
    speaking: false,
    floorDb: SILENT_DB,
    frames: 0,
    primed: false,
    startedAtMs: null,
    voiceFromMs: 0,
    lastVoiceMs: 0,
    quietSinceMs: null,
  };
}

/** One frame of audio, reduced to when it was and how loud it was. */
export interface VadFrame {
  atMs: number;
  /** RMS level in dBFS. `SILENT_DB` for digital silence. */
  db: number;
}

/**
 * Advance the detector by one frame.
 *
 * Returns the next state and, at a boundary, one event. The state is replaced
 * rather than mutated so a test can hold two of them and so the caller can keep
 * the last one in a ref without worrying about when React reads it.
 */
export function observeFrame(
  state: VadState,
  frame: VadFrame,
  settings: VadSettings = DEFAULT_VAD,
): { state: VadState; event: VadEvent | null } {
  const { atMs, db } = frame;

  // Listening, not yet deciding.
  if (!state.primed) {
    const frames = state.frames + 1;
    return {
      state: {
        ...state,
        frames,
        floorDb: state.frames === 0 ? db : Math.min(state.floorDb, db),
        primed: frames >= PRIME_FRAMES,
      },
      event: null,
    };
  }

  // The bar to clear depends on which side of it we are already on.
  const threshold =
    state.floorDb + (state.speaking ? settings.releaseDb : settings.onsetDb);
  const loud = db > threshold;

  let floorDb = state.floorDb;
  if (!loud) {
    // Only quiet updates the floor. Letting speech into the estimate is what
    // makes a detector go deaf partway through a sentence.
    const alpha = db < floorDb ? FLOOR_FALL : FLOOR_RISE;
    floorDb = floorDb + (db - floorDb) * alpha;
  }

  let next: VadState = {
    ...state,
    floorDb,
    quietSinceMs: loud ? null : (state.quietSinceMs ?? atMs),
    lastVoiceMs: loud ? atMs : state.lastVoiceMs,
  };

  if (!next.speaking) {
    if (!loud) return { state: next, event: null };

    next = {
      ...next,
      speaking: true,
      // Backdated. The onset is detected on the frame that crossed the
      // threshold, which is already past the start of the sound.
      startedAtMs: Math.max(0, atMs - settings.prerollMs),
      voiceFromMs: atMs,
    };
    return { state: next, event: { type: "start", atMs: next.startedAtMs! } };
  }

  const startedAtMs = next.startedAtMs ?? atMs;

  // A speaker who has not paused long enough to be interrupted, but has gone on
  // long enough that waiting is worse than cutting.
  if (atMs - startedAtMs >= settings.maxUtteranceMs) {
    return {
      state: {
        ...next,
        startedAtMs: atMs,
        voiceFromMs: atMs,
        quietSinceMs: loud ? null : atMs,
      },
      event: { type: "end", fromMs: startedAtMs, toMs: atMs, reason: "limit" },
    };
  }

  const quietFor =
    next.quietSinceMs === null ? 0 : atMs - next.quietSinceMs;
  if (quietFor < settings.hangoverMs) return { state: next, event: null };

  // Ends where the voice stopped plus a tail, not where the silence timer
  // expired: the intervening quiet is not part of what was said.
  const toMs = next.lastVoiceMs + settings.tailMs;
  const ended: VadState = {
    ...next,
    speaking: false,
    startedAtMs: null,
  };

  if (next.lastVoiceMs - next.voiceFromMs < settings.minUtteranceMs) {
    return {
      state: ended,
      event: { type: "drop", fromMs: startedAtMs, toMs },
    };
  }

  return {
    state: ended,
    event: { type: "end", fromMs: startedAtMs, toMs, reason: "silence" },
  };
}

/**
 * End whatever is in progress because capture is stopping.
 *
 * The last thing somebody says before leaving a meeting is often the thing
 * worth keeping, and it has no trailing silence to close it.
 */
export function flush(
  state: VadState,
  atMs: number,
  settings: VadSettings = DEFAULT_VAD,
): { state: VadState; event: VadEvent | null } {
  if (!state.speaking || state.startedAtMs === null) {
    return { state, event: null };
  }

  const fromMs = state.startedAtMs;
  const toMs = Math.min(atMs, state.lastVoiceMs + settings.tailMs);
  const ended: VadState = { ...state, speaking: false, startedAtMs: null };

  if (state.lastVoiceMs - state.voiceFromMs < settings.minUtteranceMs) {
    return { state: ended, event: { type: "drop", fromMs, toMs } };
  }

  return { state: ended, event: { type: "end", fromMs, toMs, reason: "stop" } };
}

/** RMS of a frame of samples, in dBFS. */
export function levelDb(samples: Float32Array): number {
  if (samples.length === 0) return SILENT_DB;

  let sum = 0;
  for (const sample of samples) sum += sample * sample;

  const rms = Math.sqrt(sum / samples.length);
  return rms === 0 ? SILENT_DB : Math.max(SILENT_DB, 20 * Math.log10(rms));
}
