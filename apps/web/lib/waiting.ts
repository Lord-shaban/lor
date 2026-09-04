/**
 * How often to ask whether the host has answered.
 *
 * We run no socket of our own, so the person at the door polls. That makes the
 * interval a real design decision rather than a constant: too slow and the wait
 * feels broken after the host has already pressed admit; too fast and a room
 * where somebody walked away from the prejoin quietly runs a query every two
 * seconds for the rest of the afternoon.
 *
 * So it starts at the speed a human notices and slows down as the wait stops
 * looking like a wait.
 */

/** Fast enough that admission feels immediate. */
export const FIRST_DELAY_MS = 2000;

/** After two minutes, nobody is watching the second hand any more. */
const SETTLED_AFTER_MS = 2 * 60 * 1000;
const SETTLED_DELAY_MS = 5000;

/** After ten, this is a tab somebody left open. */
const ABANDONED_AFTER_MS = 10 * 60 * 1000;
const ABANDONED_DELAY_MS = 15_000;

export function pollDelay(waitedMs: number): number {
  if (waitedMs >= ABANDONED_AFTER_MS) return ABANDONED_DELAY_MS;
  if (waitedMs >= SETTLED_AFTER_MS) return SETTLED_DELAY_MS;
  return FIRST_DELAY_MS;
}

/**
 * What the person at the door is actually looking at.
 *
 * `hostGone` is separate from `waiting` on purpose. "Waiting for the host" and
 * "nobody is in there to let you in" are different situations, and telling
 * somebody the first when the second is true is how a person ends up staring at
 * a spinner for ten minutes.
 */
export type WaitingState = "waiting" | "hostGone" | "admitted" | "denied";

export function waitingState({
  status,
  hostPresent,
}: {
  status: "pending" | "admitted" | "denied";
  /** Null when the media server could not be asked, which is not an answer. */
  hostPresent: boolean | null;
}): WaitingState {
  if (status === "admitted") return "admitted";
  if (status === "denied") return "denied";
  // Only an explicit "no host here" changes the message. A failed lookup leaves
  // it alone: telling somebody the host left because our own call timed out
  // would be worse than saying nothing.
  return hostPresent === false ? "hostGone" : "waiting";
}
