import { describe, expect, it } from "vitest";
import {
  NO_DEGRADATION,
  POOR_HOLD_MS,
  SAMPLE_INTERVAL_MS,
  observeQuality,
  type DegradationState,
} from "./degradation";

/** Feed a run of samples and report every moment it would have stepped down. */
function run(
  samples: Array<{ poor: boolean; at: number; automatic?: boolean }>,
): number[] {
  let state: DegradationState = NO_DEGRADATION;
  const reduced: number[] = [];

  for (const sample of samples) {
    const result = observeQuality({
      state,
      poor: sample.poor,
      automatic: sample.automatic ?? true,
      now: sample.at,
    });
    state = result.state;
    if (result.reduce) reduced.push(sample.at);
  }

  return reduced;
}

/** A steady stream of samples of one kind. */
function steady(poor: boolean, from: number, to: number, automatic = true) {
  const samples = [];
  for (let at = from; at <= to; at += SAMPLE_INTERVAL_MS) {
    samples.push({ poor, at, automatic });
  }
  return samples;
}

describe("observeQuality", () => {
  it("does nothing while the connection is fine", () => {
    expect(run(steady(false, 0, 60_000))).toEqual([]);
  });

  it("steps down once the connection has been poor long enough", () => {
    const reduced = run(steady(true, 0, 30_000));
    expect(reduced).toHaveLength(1);
    expect(reduced[0]).toBeGreaterThanOrEqual(POOR_HOLD_MS);
  });

  it("ignores a blip", () => {
    // A lift, a microwave, a car going under a bridge. Dropping the video of a
    // call that was fine is worse than the few seconds this waits through.
    expect(
      run([
        ...steady(false, 0, 10_000),
        { poor: true, at: 12_000 },
        { poor: true, at: 14_000 },
        ...steady(false, 16_000, 40_000),
      ]),
    ).toEqual([]);
  });

  it("needs the run to be unbroken", () => {
    // Poor for six seconds, one good sample, poor again: the clock restarts.
    expect(
      run([
        ...steady(true, 0, 6_000),
        { poor: false, at: 8_000 },
        ...steady(true, 10_000, 16_000),
      ]),
    ).toEqual([]);
  });

  it("does not step down twice for the same bad patch", () => {
    expect(run(steady(true, 0, 120_000))).toHaveLength(1);
  });

  it("can act again after the connection recovers and fails again", () => {
    const reduced = run([
      ...steady(true, 0, 20_000),
      ...steady(false, 22_000, 40_000),
      ...steady(true, 42_000, 62_000),
    ]);
    expect(reduced).toHaveLength(2);
  });

  it("never overrides a mode somebody chose themselves", () => {
    // If they picked full video on a bad line, they had a reason, and this code
    // does not know what it is.
    expect(run(steady(true, 0, 120_000, false))).toEqual([]);
  });

  it("forgets the bad patch as soon as a choice is made", () => {
    const before = observeQuality({
      state: { poorSince: 0, acted: false },
      poor: true,
      automatic: false,
      now: 60_000,
    });
    expect(before).toEqual({ state: NO_DEGRADATION, reduce: false });
  });

  it("holds long enough to be sure and short enough to be useful", () => {
    expect(POOR_HOLD_MS).toBeGreaterThanOrEqual(5_000);
    expect(POOR_HOLD_MS).toBeLessThanOrEqual(15_000);
    // Several samples have to fit inside the hold, or the decision rests on one.
    expect(POOR_HOLD_MS / SAMPLE_INTERVAL_MS).toBeGreaterThanOrEqual(3);
  });

  it("does not mutate the state it was given", () => {
    const state: DegradationState = { poorSince: 1000, acted: false };
    observeQuality({ state, poor: true, automatic: true, now: 99_000 });
    expect(state).toEqual({ poorSince: 1000, acted: false });
  });
});
