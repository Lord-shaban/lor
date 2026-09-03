/**
 * How many columns to use for N tiles in a given box.
 *
 * A fixed breakpoint table ("three across on desktop") looks fine at the sizes
 * it was tuned for and wastes half the screen everywhere else — most visibly
 * with two people on a wide monitor, or five on a phone in portrait. So the
 * layout is measured instead: try every column count and keep whichever makes
 * the tiles biggest.
 */

export interface GridLayout {
  columns: number;
  rows: number;
  /** Tile width in pixels, already accounting for the gaps. */
  tileWidth: number;
  tileHeight: number;
}

export interface GridOptions {
  count: number;
  width: number;
  height: number;
  gap?: number;
  /** Video is 16:9; a tile that does not match it letterboxes. */
  aspectRatio?: number;
}

export function computeGridLayout({
  count,
  width,
  height,
  gap = 12,
  aspectRatio = 16 / 9,
}: GridOptions): GridLayout {
  if (count <= 0 || width <= 0 || height <= 0) {
    return { columns: 1, rows: 1, tileWidth: 0, tileHeight: 0 };
  }

  let best: GridLayout = { columns: 1, rows: count, tileWidth: 0, tileHeight: 0 };

  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);

    const availableWidth = width - gap * (columns - 1);
    const availableHeight = height - gap * (rows - 1);
    if (availableWidth <= 0 || availableHeight <= 0) continue;

    // The tile is limited by whichever axis runs out first.
    const widthLimited = availableWidth / columns;
    const heightLimited = (availableHeight / rows) * aspectRatio;
    const tileWidth = Math.min(widthLimited, heightLimited);

    if (tileWidth > best.tileWidth) {
      best = {
        columns,
        rows,
        tileWidth,
        tileHeight: tileWidth / aspectRatio,
      };
    }
  }

  return best;
}

/**
 * How long someone has to stay quiet before the active-speaker highlight moves.
 *
 * LiveKit already smooths its speaking flag, but a cough or a chair scrape still
 * flips it for a moment. Without a hold, a room of five turns the highlight into
 * a strobe, which is worse than not having one.
 */
export const ACTIVE_SPEAKER_HOLD_MS = 1500;

/**
 * Pick who to highlight, keeping the previous choice until the hold expires.
 *
 * Pure so the timing rule is testable without a room, a clock, or a microphone.
 */
export function resolveActiveSpeaker({
  speaking,
  previous,
  previousSince,
  now,
  holdMs = ACTIVE_SPEAKER_HOLD_MS,
}: {
  /** Identities currently flagged as speaking, loudest first. */
  speaking: string[];
  previous: string | null;
  previousSince: number;
  now: number;
  holdMs?: number;
}): { identity: string | null; since: number } {
  const loudest = speaking[0] ?? null;

  // Still talking: nothing to decide.
  if (loudest && loudest === previous) {
    return { identity: previous, since: previousSince };
  }

  // Nobody is talking. Keep the last speaker on screen rather than dropping the
  // highlight into nowhere during a pause.
  if (!loudest) {
    return { identity: previous, since: previousSince };
  }

  // Somebody else started. Only hand over once the current speaker has held the
  // highlight long enough that the change reads as a turn rather than a twitch.
  if (previous && now - previousSince < holdMs) {
    return { identity: previous, since: previousSince };
  }

  return { identity: loudest, since: now };
}
