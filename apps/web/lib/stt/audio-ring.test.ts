import { describe, expect, it } from "vitest";
import { AudioRing } from "./audio-ring";

/** A thousand samples a second makes a millisecond a sample. */
const RATE = 1000;

/** Samples numbered from `start`, so any span identifies itself. */
const ramp = (start: number, length: number) =>
  Float32Array.from({ length }, (_, i) => start + i);

describe("AudioRing", () => {
  it("reads back what was written", () => {
    const ring = new AudioRing(RATE, 1000);
    ring.write(ramp(0, 500));

    expect(Array.from(ring.read(0, 100)!)).toEqual(Array.from(ramp(0, 100)));
    expect(Array.from(ring.read(200, 250)!)).toEqual(Array.from(ramp(200, 50)));
  });

  it("keeps time as a clock, in milliseconds", () => {
    const ring = new AudioRing(RATE, 1000);
    expect(ring.writtenMs).toBe(0);
    ring.write(ramp(0, 250));
    expect(ring.writtenMs).toBe(250);
    expect(ring.earliestMs).toBe(0);
  });

  it("reads across the wrap", () => {
    // The case that is wrong in every ring buffer that was never tested: a
    // span straddling the end of the array.
    const ring = new AudioRing(RATE, 100);
    ring.write(ramp(0, 80));
    ring.write(ramp(80, 60)); // wraps at 100

    expect(Array.from(ring.read(70, 110)!)).toEqual(Array.from(ramp(70, 40)));
  });

  it("refuses a span it has overwritten", () => {
    // The whole reason this returns null. Answering with whatever is at those
    // indices hands the transcriber a sentence spliced from two moments, which
    // is worse than a gap because nothing about it looks wrong.
    const ring = new AudioRing(RATE, 100);
    ring.write(ramp(0, 250));

    expect(ring.read(0, 50)).toBeNull();
    expect(ring.read(140, 160)).toBeNull();
    expect(Array.from(ring.read(160, 200)!)).toEqual(Array.from(ramp(160, 40)));
  });

  it("clamps a span that runs past what has arrived", () => {
    // The tail of an utterance can be asked for a fraction before all of it is
    // in. Returning what exists is right; returning null would drop the end of
    // every sentence.
    const ring = new AudioRing(RATE, 1000);
    ring.write(ramp(0, 100));

    const span = ring.read(80, 200)!;
    expect(Array.from(span)).toEqual(Array.from(ramp(80, 20)));
  });

  it("has nothing to say about an empty or backwards span", () => {
    const ring = new AudioRing(RATE, 1000);
    ring.write(ramp(0, 100));

    expect(ring.read(50, 50)).toBeNull();
    expect(ring.read(60, 40)).toBeNull();
    expect(ring.read(-10, 20)).toBeNull();
  });

  it("survives a block longer than itself without rotating everything after it", () => {
    // A backgrounded tab resuming delivers one enormous block. Only its tail
    // can be kept — but the samples that are kept still have to sit at their
    // own absolute positions, or every later read is off by the overflow.
    const ring = new AudioRing(RATE, 100);
    ring.write(ramp(0, 250));

    expect(ring.writtenMs).toBe(250);
    expect(Array.from(ring.read(150, 250)!)).toEqual(Array.from(ramp(150, 100)));

    // And the ring keeps working afterwards, at the right offset.
    ring.write(ramp(250, 30));
    expect(Array.from(ring.read(240, 280)!)).toEqual(Array.from(ramp(240, 40)));
  });

  it("reports how far back it can still see", () => {
    const ring = new AudioRing(RATE, 100);
    expect(ring.capacityMs).toBe(100);

    ring.write(ramp(0, 60));
    expect(ring.earliestMs).toBe(0);

    ring.write(ramp(60, 100));
    expect(ring.earliestMs).toBe(60);
  });

  it("holds a pre-roll's worth of the past", () => {
    // The property the whole class exists for: three hundred milliseconds ago
    // is still readable at the moment an onset is noticed.
    const ring = new AudioRing(RATE, 25_000);
    ring.write(ramp(0, 5000));

    const onset = ring.writtenMs;
    expect(ring.read(onset - 300, onset)).not.toBeNull();
    expect(ring.read(onset - 300, onset)!.length).toBe(300);
  });
});
