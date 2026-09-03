/**
 * The chat log for one session, and the arithmetic behind the unread badge.
 *
 * Kept apart from the panel that draws it because both rules here are easy to
 * get subtly wrong and impossible to see on screen: a log that grows without
 * bound only hurts an hour into a call, and an unread count is off by one long
 * before anybody notices which one.
 */

export interface ChatEntry {
  /**
   * Unique within this browser. The sender's id alone is not enough — it comes
   * from a peer, which is free to repeat one.
   */
  key: string;
  /** From the media server, never from the payload. */
  identity: string;
  /** What the sender chose to be called. Display only. */
  name: string;
  body: string;
  /**
   * Stamped on arrival by the receiving client.
   *
   * The sender's clock is not ours and may be minutes out; a timestamp taken
   * from the wire produces a log that reads out of order on screen while being
   * in order in memory.
   */
  at: number;
  mine: boolean;
}

/**
 * How much of a long meeting stays in the panel.
 *
 * Nothing is persisted in this release, so this is purely about not holding a
 * whole day of messages in a tab that also has to decode video.
 */
export const MAX_CHAT_ENTRIES = 300;

/** Append, dropping the oldest once the log is full. */
export function appendEntry(
  entries: readonly ChatEntry[],
  entry: ChatEntry,
  max: number = MAX_CHAT_ENTRIES,
): ChatEntry[] {
  const next = [...entries, entry];
  return next.length > max ? next.slice(next.length - max) : next;
}

/**
 * How many messages the badge should show.
 *
 * `received` is a running total rather than the log's length: trimming the log
 * must not make the badge count backwards.
 */
export function unreadCount({
  received,
  read,
  open,
}: {
  received: number;
  read: number;
  /** An open panel has no unread messages, by definition. */
  open: boolean;
}): number {
  if (open) return 0;
  return Math.max(0, received - read);
}
