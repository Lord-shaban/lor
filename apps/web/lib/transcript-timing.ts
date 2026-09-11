/**
 * The VAD capture configuration accepts utterances from 250 ms to 20 seconds.
 * A trailing silence window and a small pre-roll are part of the captured span,
 * so the durable record allows one conservative extra second. This is a
 * validation boundary, never a conversion: invalid client values are refused.
 */
export const MIN_CAPTURED_SPEECH_MS = 250;
export const MAX_CAPTURED_SPEECH_MS = 21_000;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TranscriptTimingRequest =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "timeline"; occurrenceId: string; durationMs: number };

/**
 * Parse the optional timing envelope without deciding its occurrence. The
 * route still looks up the active occurrence server-side and treats a missing
 * or stale one as an ordinary, non-timeline transcript line.
 */
export function readTranscriptTimingRequest(input: unknown): TranscriptTimingRequest {
  if (!input || typeof input !== "object") return { kind: "none" };

  const { occurrenceId, durationMs } = input as {
    occurrenceId?: unknown;
    durationMs?: unknown;
  };
  const supplied = occurrenceId !== undefined || durationMs !== undefined;
  if (!supplied) return { kind: "none" };

  if (
    typeof occurrenceId !== "string" ||
    !UUID.test(occurrenceId) ||
    !isCapturedSpeechDuration(durationMs)
  ) {
    return { kind: "invalid" };
  }

  return { kind: "timeline", occurrenceId, durationMs };
}

export function isCapturedSpeechDuration(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_CAPTURED_SPEECH_MS &&
    value <= MAX_CAPTURED_SPEECH_MS
  );
}
