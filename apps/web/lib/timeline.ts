/** A manual marker is a brief cue, not a second transcript field. */
export const MAX_MANUAL_MOMENT_LABEL_LENGTH = 200;

export type ManualMomentLabel =
  | { kind: "valid"; label: string | null }
  | { kind: "invalid" };

/**
 * Preserve the difference between no label and bad participant input. Blank
 * labels become an unlabeled marker; non-text and oversized values are refused
 * before they can reach the durable record.
 */
export function readManualMomentLabel(value: unknown): ManualMomentLabel {
  if (value === undefined || value === null) return { kind: "valid", label: null };
  if (typeof value !== "string") return { kind: "invalid" };

  const label = value.trim();
  if (label.length > MAX_MANUAL_MOMENT_LABEL_LENGTH) return { kind: "invalid" };
  return { kind: "valid", label: label || null };
}

export interface CapturedSpeechLine {
  identity: string;
  name: string;
  durationMs: number;
}

export interface CapturedSpeechTotal {
  identity: string;
  /** Latest retained display-name snapshot for this canonical identity. */
  name: string;
  durationMs: number;
}

/**
 * Lines must be in server transcript order. We sum only persisted VAD spans,
 * and take the latest retained name for an identity; that is captured speech,
 * not attendance, mic-on time, or an estimate of every word spoken.
 */
export function capturedSpeechTotals(
  lines: readonly CapturedSpeechLine[],
): CapturedSpeechTotal[] {
  const totals = new Map<string, CapturedSpeechTotal>();
  for (const line of lines) {
    const current = totals.get(line.identity);
    totals.set(line.identity, {
      identity: line.identity,
      name: line.name,
      durationMs: (current?.durationMs ?? 0) + line.durationMs,
    });
  }

  return [...totals.values()].toSorted(
    (a, b) => b.durationMs - a.durationMs || a.identity.localeCompare(b.identity),
  );
}
