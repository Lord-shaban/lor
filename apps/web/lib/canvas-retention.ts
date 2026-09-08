/**
 * Canvas stores what a room draws and writes, so it follows the same maximum
 * retention promise as a transcript. Operators may shorten it, never quietly
 * lengthen it past what the meeting is told.
 */
export const CANVAS_RETENTION_DAYS = 30;

export function canvasRetentionDays(env: Record<string, string | undefined>) {
  const raw = env.LOR_CANVAS_RETENTION_DAYS;
  if (raw === undefined || raw.trim() === "") return CANVAS_RETENTION_DAYS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return CANVAS_RETENTION_DAYS;

  return Math.min(Math.floor(parsed), CANVAS_RETENTION_DAYS);
}

export function canvasKeptSince(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
