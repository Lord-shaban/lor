import { lineDirection, type Direction } from "@/lib/bidi";

/**
 * What is on screen, while two engines disagree about it.
 *
 * A caption that arrives two seconds late is not a caption — the conversation
 * has moved. But the accurate transcription of an utterance cannot exist until
 * the utterance is over, plus a network round trip. So two passes run over the
 * same audio, each doing the thing it is good at:
 *
 *   the browser's recogniser   fast, on device, free, and worse at exactly the
 *                              problem this product is about — it wants one
 *                              language chosen up front and transliterates
 *   the accurate pass          slower, costs money, and is the record
 *
 * This module owns the one hard part: they do not agree, they do not arrive in
 * order, and only one of them may be on screen. A line is keyed by the
 * *utterance* — the boundary `vad.ts` found — so the fast pass fills a slot the
 * slow pass will later replace, in place, rather than the two racing to append.
 *
 * Pure, because every rule here is an ordering rule and ordering bugs are
 * invisible until the day the network is slow.
 */

export type LineState = "provisional" | "settled";

export interface CaptionLine {
  /** The utterance this line is about. Stable across both passes. */
  id: string;
  /** Whose audio it was. From the media server, never from the message. */
  speaker: string;
  text: string;
  state: LineState;
  /** When the utterance began, for ordering. Not when the text arrived. */
  atMs: number;
  /**
   * Which way to lay the line out.
   *
   * Held on the line rather than recomputed at render, so that a line still
   * arriving settles its direction once instead of flipping as words appear.
   * See `lib/bidi.ts` — this is the case that module was built for.
   */
  direction: Direction;
}

/**
 * How many lines to keep.
 *
 * A caption strip is not a transcript. The record is #93's problem, and keeping
 * an hour of meeting in a component's state to show three lines of it is how a
 * long call slows down.
 */
export const MAX_LINES = 40;

export interface CaptionLog {
  lines: readonly CaptionLine[];
  /**
   * Utterances that have already settled.
   *
   * Kept so a provisional result arriving after its own settled text cannot
   * reopen it — the accurate pass wins even when it wins first.
   */
  settled: ReadonlySet<string>;
}

export function createCaptionLog(): CaptionLog {
  return { lines: [], settled: new Set() };
}

export interface Utterance {
  id: string;
  speaker: string;
  atMs: number;
}

/**
 * A guess from the fast pass.
 *
 * Ignored once the accurate text for that utterance has arrived, which is the
 * whole reason `settled` is a set rather than a flag on the line: the line may
 * have been evicted by the cap and still must not come back.
 */
export function provisional(
  log: CaptionLog,
  utterance: Utterance,
  text: string,
  locale: Direction,
): CaptionLog {
  if (log.settled.has(utterance.id)) return log;
  if (!text.trim()) return log;

  return write(log, utterance, text, "provisional", locale);
}

/** The accurate text. Replaces whatever was there, always. */
export function settle(
  log: CaptionLog,
  utterance: Utterance,
  text: string,
  locale: Direction,
): CaptionLog {
  const settled = new Set(log.settled);
  settled.add(utterance.id);

  // An empty accurate result means the utterance held no speech after all — a
  // cough that got past the detector. Take the line away rather than leaving a
  // guess on screen that nothing will ever correct.
  if (!text.trim()) {
    return {
      lines: log.lines.filter((line) => line.id !== utterance.id),
      settled,
    };
  }

  return { ...write(log, utterance, text, "settled", locale), settled };
}

/**
 * Give up on an utterance.
 *
 * The detector dropped it as too short, or the request failed. Either way
 * nothing is coming, and a provisional guess left on screen forever is worse
 * than a line that never appeared.
 */
export function abandon(log: CaptionLog, id: string): CaptionLog {
  return {
    lines: log.lines.filter((line) => line.id !== id),
    settled: log.settled,
  };
}

function write(
  log: CaptionLog,
  utterance: Utterance,
  text: string,
  state: LineState,
  locale: Direction,
): CaptionLog {
  const index = log.lines.findIndex((line) => line.id === utterance.id);
  const existing = index === -1 ? undefined : log.lines[index];

  const line: CaptionLine = {
    id: utterance.id,
    speaker: utterance.speaker,
    text,
    state,
    atMs: existing?.atMs ?? utterance.atMs,
    // The direction the line already had is the fallback, so a half-arrived
    // sentence holds still instead of settling twice.
    direction: lineDirection(text, existing?.direction ?? locale),
  };

  if (existing) {
    const lines = [...log.lines];
    lines[index] = line;
    return { ...log, lines };
  }

  // Inserted by when the utterance began, not by when its text arrived. Two
  // people talking over each other produce results out of order, and a strip
  // that reorders itself as they land is unreadable.
  const lines = [...log.lines, line].sort((a, b) => a.atMs - b.atMs);
  return { ...log, lines: lines.slice(-MAX_LINES) };
}
