/**
 * Convert a durable Timeline timestamp into a position in one browser-local
 * recording. Both boundaries come from the recorder in this tab; no server
 * clock, file metadata, or media bytes are involved.
 */
export function recordingOffsetAt({
  startedAt,
  endedAt,
  momentAt,
}: {
  startedAt: number;
  endedAt: number;
  momentAt: number;
}):
  | { kind: "seekable"; offsetMs: number }
  | { kind: "invalid" | "before-recording" | "after-recording" } {
  if (
    !Number.isFinite(startedAt)
    || !Number.isFinite(endedAt)
    || !Number.isFinite(momentAt)
    || endedAt < startedAt
  ) {
    return { kind: "invalid" };
  }
  if (momentAt < startedAt) return { kind: "before-recording" };
  if (momentAt > endedAt) return { kind: "after-recording" };
  return { kind: "seekable", offsetMs: momentAt - startedAt };
}
