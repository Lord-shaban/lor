/**
 * How long a transcript is kept, and who may ask for it.
 *
 * A retention period that lives only in a comment is not a retention period.
 * This is the one place the number exists; `SECURITY.md`, the interface and the
 * sweep all read from here, so they cannot drift apart the way a promise and an
 * implementation usually do.
 */

/**
 * Thirty days.
 *
 * Long enough that "what did we decide last month" is a question the product
 * can answer, which is the whole premise. Short enough that a room nobody
 * remembers creating is not still holding what was said in it a year later.
 *
 * An operator may shorten it. Lengthening it past the default is deliberately
 * not offered by an environment variable: it is a promise made to participants
 * in the interface, and quietly extending it in a config file would break that
 * promise without anybody in the room being told.
 */
export const RETENTION_DAYS = 30;

export function retentionDays(
  env: Record<string, string | undefined>,
): number {
  const raw = env.LOR_TRANSCRIPT_RETENTION_DAYS;
  if (raw === undefined || raw.trim() === "") return RETENTION_DAYS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return RETENTION_DAYS;

  // Shorter only. See above: the interface tells participants a number, and an
  // operator raising it silently would be telling them something untrue.
  return Math.min(Math.floor(parsed), RETENTION_DAYS);
}

/** The oldest line that should still exist. */
export function keptSince(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
