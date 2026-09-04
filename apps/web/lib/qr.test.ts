import { describe, expect, it } from "vitest";
import { QUIET_ZONE, qrCode } from "./qr";

const LINK = "https://lor-bay.vercel.app/mza-krfq-tqn";

describe("qrCode", () => {
  it("produces a square with the quiet zone included", () => {
    const { size } = qrCode(LINK);
    // Every QR version is 21 + 4n modules across, plus the margin on both sides.
    const modules = size - QUIET_ZONE * 2;
    expect(modules).toBeGreaterThanOrEqual(21);
    expect((modules - 21) % 4).toBe(0);
  });

  it("keeps the margin the specification requires", () => {
    // Scanners find the edges of a code by its quiet zone. Without one, a QR
    // butted against other content often will not read at all — and the failure
    // looks like a bad camera rather than a bad margin.
    expect(QUIET_ZONE).toBeGreaterThanOrEqual(4);
  });

  it("draws nothing inside the margin", () => {
    const { size, path } = qrCode(LINK);
    const coordinates = [...path.matchAll(/M(\d+) (\d+)/g)].map(
      ([, x, y]) => [Number(x), Number(y)] as const,
    );

    expect(coordinates.length).toBeGreaterThan(0);
    for (const [x, y] of coordinates) {
      expect(x).toBeGreaterThanOrEqual(QUIET_ZONE);
      expect(y).toBeGreaterThanOrEqual(QUIET_ZONE);
      expect(x).toBeLessThan(size - QUIET_ZONE);
      expect(y).toBeLessThan(size - QUIET_ZONE);
    }
  });

  it("puts a finder pattern in each of the three corners", () => {
    // The three 7×7 squares a scanner locates first. If these are missing or
    // misplaced the code is unreadable however pretty it looks, and nothing
    // else in this file would notice.
    const { size, path } = qrCode(LINK);
    const dark = new Set(
      [...path.matchAll(/M(\d+) (\d+)/g)].map(([, x, y]) => `${x},${y}`),
    );
    const last = size - QUIET_ZONE - 1;

    const corners = [
      [QUIET_ZONE, QUIET_ZONE],
      [last - 6, QUIET_ZONE],
      [QUIET_ZONE, last - 6],
    ] as const;

    for (const [x, y] of corners) {
      // Outer ring dark, the square inside it light, centre dark.
      expect(dark.has(`${x},${y}`)).toBe(true);
      expect(dark.has(`${x + 6},${y}`)).toBe(true);
      expect(dark.has(`${x + 1},${y + 1}`)).toBe(false);
      expect(dark.has(`${x + 3},${y + 3}`)).toBe(true);
    }
  });

  it("is deterministic", () => {
    expect(qrCode(LINK)).toEqual(qrCode(LINK));
  });

  it("encodes different links differently", () => {
    expect(qrCode(LINK).path).not.toBe(
      qrCode("https://lor-bay.vercel.app/tdv-sbbr-jms").path,
    );
  });

  it("grows for a longer link rather than truncating it", () => {
    const short = qrCode("https://lor.dev/abc");
    const long = qrCode(`https://lor.dev/${"a".repeat(300)}`);
    expect(long.size).toBeGreaterThan(short.size);
  });
});
