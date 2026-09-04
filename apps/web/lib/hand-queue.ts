/**
 * Who has a hand up, in the order the hands went up.
 *
 * The order is the entire feature. A set of raised hands tells a host who wants
 * to speak; a queue tells them who has been waiting longest, which is the only
 * version of it that is fair. Kept pure so the ordering rules can be tested
 * without a room, a clock, or four people.
 */

export interface RaisedHand {
  identity: string;
  /** Display only, and refreshed on every announcement in case it changed. */
  name: string;
  /**
   * When the hand went up, on *this* client's clock.
   *
   * Derived by subtracting the sender's reported age from local `now`, never
   * read from the wire as an absolute time. Two browsers minutes out of step
   * still agree on the order.
   */
  at: number;
}

export interface HandUpdate {
  identity: string;
  name: string;
  raised: boolean;
  at: number;
}

/**
 * Apply one hand message to the queue.
 *
 * Re-announcing a hand that is already up must not move it: someone joining
 * late makes every raised hand announce itself again, and a queue that
 * reshuffled on each arrival would punish whoever has waited longest.
 */
export function applyHand(
  queue: readonly RaisedHand[],
  update: HandUpdate,
): RaisedHand[] {
  const existing = queue.find((hand) => hand.identity === update.identity);

  if (!update.raised) {
    return existing
      ? queue.filter((hand) => hand.identity !== update.identity)
      : [...queue];
  }

  const next = existing
    ? queue.map((hand) =>
        hand.identity === update.identity
          ? // Keep the original position; take the newer name.
            { ...hand, name: update.name }
          : hand,
      )
    : [...queue, { identity: update.identity, name: update.name, at: update.at }];

  return sortQueue(next);
}

/** Drop anyone who has left the room. */
export function pruneHands(
  queue: readonly RaisedHand[],
  present: ReadonlySet<string>,
): RaisedHand[] {
  return queue.filter((hand) => present.has(hand.identity));
}

/**
 * Oldest first, with identity as the tie-break.
 *
 * Two hands can land in the same millisecond — most likely on a late join,
 * where several are reconstructed from durations at once. Without a stable
 * second key their order would depend on arrival and could differ between two
 * people looking at the same room.
 */
function sortQueue(queue: readonly RaisedHand[]): RaisedHand[] {
  return [...queue].sort(
    (a, b) => a.at - b.at || (a.identity < b.identity ? -1 : 1),
  );
}
