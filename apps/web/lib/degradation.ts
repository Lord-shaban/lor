/**
 * When to spend less on video without being asked.
 *
 * A call that is breaking up is the worst moment to expect somebody to find a
 * control, so the call gives up video on their behalf and says that it did. The
 * saying matters as much as the doing: quality that drops silently reads as the
 * product being bad, and the person on the other end getting quieter reads as
 * them being rude.
 *
 * Pure, because every rule here is about time, and time is the one thing a
 * browser test cannot hold still.
 */

/**
 * How long the connection has to stay poor before anything happens.
 *
 * A single poor sample is a lift, a microwave, or a car going under a bridge.
 * Acting on one would mean the video dropping out of a call that was fine, which
 * is a worse experience than the eight seconds of bad video this waits through.
 */
export const POOR_HOLD_MS = 8000;

/** How often the connection is sampled. Quality events do not repeat while it stays bad. */
export const SAMPLE_INTERVAL_MS = 2000;

export interface DegradationState {
  /** When the current unbroken run of poor quality began, or null. */
  poorSince: number | null;
  /**
   * Whether this run of poor quality has already been acted on.
   *
   * Carried here rather than inferred from the caller having switched mode.
   * The first version left it to the caller and the tests caught it: fed a
   * connection that stayed poor, it stepped down every eight seconds forever,
   * and only the caller flipping a flag stopped it. A rule that depends on its
   * caller to stop is not a rule.
   */
  acted: boolean;
}

export const NO_DEGRADATION: DegradationState = { poorSince: null, acted: false };

/**
 * Fold one quality sample into the state, and say whether to step down now.
 *
 * `automatic` is false when the person has already chosen a mode themselves. A
 * choice someone made is not a default to be overridden — if they picked full
 * video on a bad line, they had a reason, and the product does not know it.
 */
export function observeQuality({
  state,
  poor,
  automatic,
  now,
  holdMs = POOR_HOLD_MS,
}: {
  state: DegradationState;
  poor: boolean;
  /** Whether this device is still on the automatic setting. */
  automatic: boolean;
  now: number;
  holdMs?: number;
}): { state: DegradationState; reduce: boolean } {
  if (!automatic || !poor) {
    return { state: NO_DEGRADATION, reduce: false };
  }

  if (state.poorSince === null) {
    return { state: { poorSince: now, acted: false }, reduce: false };
  }

  // Once for each bad patch. Recovery clears this, so a later one can act again.
  if (state.acted || now - state.poorSince < holdMs) {
    return { state, reduce: false };
  }

  return { state: { poorSince: state.poorSince, acted: true }, reduce: true };
}
