import { describe, expect, it } from "vitest";
import {
  computeGridLayout,
  resolveActiveSpeaker,
  ACTIVE_SPEAKER_HOLD_MS,
} from "./grid-layout";

const DESKTOP = { width: 1280, height: 720 };
const PHONE_PORTRAIT = { width: 390, height: 640 };

describe("computeGridLayout", () => {
  it.each([1, 2, 3, 4, 5, 6, 9, 12, 16, 20])(
    "fits %i tiles inside the box",
    (count) => {
      const layout = computeGridLayout({ count, ...DESKTOP });

      expect(layout.columns * layout.rows).toBeGreaterThanOrEqual(count);
      expect(layout.tileWidth).toBeGreaterThan(0);

      const usedWidth =
        layout.columns * layout.tileWidth + 12 * (layout.columns - 1);
      const usedHeight =
        layout.rows * layout.tileHeight + 12 * (layout.rows - 1);

      // The whole point of measuring: nothing may overflow at any count.
      expect(usedWidth).toBeLessThanOrEqual(DESKTOP.width + 0.001);
      expect(usedHeight).toBeLessThanOrEqual(DESKTOP.height + 0.001);
    },
  );

  it("gives one person the whole box", () => {
    const layout = computeGridLayout({ count: 1, ...DESKTOP });
    expect(layout.columns).toBe(1);
    expect(layout.rows).toBe(1);
  });

  it("puts two people side by side on a wide screen", () => {
    // A fixed three-column rule would stack them and waste half the width.
    expect(computeGridLayout({ count: 2, ...DESKTOP }).columns).toBe(2);
  });

  it("stacks two people on a phone in portrait", () => {
    // The same two participants, the opposite answer. This is why the layout is
    // measured rather than tabulated.
    expect(computeGridLayout({ count: 2, ...PHONE_PORTRAIT }).columns).toBe(1);
  });

  it("keeps every tile at 16:9", () => {
    for (const count of [1, 3, 7, 20]) {
      const layout = computeGridLayout({ count, ...DESKTOP });
      expect(layout.tileWidth / layout.tileHeight).toBeCloseTo(16 / 9, 5);
    }
  });

  it("never shrinks a tile below what a larger column count would give", () => {
    // Guards the search: a greedy or hardcoded choice loses to some column
    // count at some size, and this is where that would show up.
    for (const count of [3, 5, 7, 11]) {
      const chosen = computeGridLayout({ count, ...DESKTOP });
      for (let columns = 1; columns <= count; columns++) {
        const rows = Math.ceil(count / columns);
        const tileWidth = Math.min(
          (DESKTOP.width - 12 * (columns - 1)) / columns,
          ((DESKTOP.height - 12 * (rows - 1)) / rows) * (16 / 9),
        );
        expect(chosen.tileWidth).toBeGreaterThanOrEqual(tileWidth - 0.001);
      }
    }
  });

  it("degrades safely when the box has no room", () => {
    expect(computeGridLayout({ count: 5, width: 0, height: 0 }).tileWidth).toBe(0);
    expect(computeGridLayout({ count: 0, ...DESKTOP }).tileWidth).toBe(0);
  });
});

describe("resolveActiveSpeaker", () => {
  it("picks the loudest when nobody was highlighted", () => {
    const result = resolveActiveSpeaker({
      speaking: ["a", "b"],
      previous: null,
      previousSince: 0,
      now: 1000,
    });
    expect(result.identity).toBe("a");
    expect(result.since).toBe(1000);
  });

  it("stays put while the same person keeps talking", () => {
    const result = resolveActiveSpeaker({
      speaking: ["a"],
      previous: "a",
      previousSince: 500,
      now: 9000,
    });
    expect(result.identity).toBe("a");
    // The timestamp must not creep forward, or the hold would never expire.
    expect(result.since).toBe(500);
  });

  it("ignores a brief interruption inside the hold", () => {
    // A cough or a chair scrape. Without this the highlight strobes in any room
    // with more than two people.
    const result = resolveActiveSpeaker({
      speaking: ["b"],
      previous: "a",
      previousSince: 1000,
      now: 1000 + ACTIVE_SPEAKER_HOLD_MS - 1,
    });
    expect(result.identity).toBe("a");
  });

  it("hands over once the hold has expired", () => {
    const result = resolveActiveSpeaker({
      speaking: ["b"],
      previous: "a",
      previousSince: 1000,
      now: 1000 + ACTIVE_SPEAKER_HOLD_MS + 1,
    });
    expect(result.identity).toBe("b");
    expect(result.since).toBe(1000 + ACTIVE_SPEAKER_HOLD_MS + 1);
  });

  it("keeps the last speaker highlighted through a silence", () => {
    // Dropping the highlight during a pause makes it flash off between
    // sentences, which reads as a glitch rather than as information.
    const result = resolveActiveSpeaker({
      speaking: [],
      previous: "a",
      previousSince: 1000,
      now: 60_000,
    });
    expect(result.identity).toBe("a");
  });

  it("does not strobe when two people talk over each other", () => {
    // Simulate the flag flipping every 200ms for six seconds and count how
    // often the highlight actually moves.
    let identity: string | null = null;
    let since = 0;
    let changes = 0;

    for (let now = 0; now <= 6000; now += 200) {
      const speaking = [now % 400 === 0 ? "a" : "b"];
      const next = resolveActiveSpeaker({ speaking, previous: identity, previousSince: since, now });
      if (next.identity !== identity) changes++;
      identity = next.identity;
      since = next.since;
    }

    // Six seconds of alternation would be thirty changes unheld. The hold caps
    // it at roughly one per 1.5 seconds.
    expect(changes).toBeLessThanOrEqual(5);
  });
});
