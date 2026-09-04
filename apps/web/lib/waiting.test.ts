import { describe, expect, it } from "vitest";
import { FIRST_DELAY_MS, pollDelay, waitingState } from "./waiting";

describe("pollDelay", () => {
  it("starts fast enough that admission feels immediate", () => {
    expect(pollDelay(0)).toBe(FIRST_DELAY_MS);
    expect(FIRST_DELAY_MS).toBeLessThanOrEqual(2000);
  });

  it("keeps that pace for the first couple of minutes", () => {
    expect(pollDelay(30_000)).toBe(FIRST_DELAY_MS);
    expect(pollDelay(110_000)).toBe(FIRST_DELAY_MS);
  });

  it("slows down once nobody is watching the second hand", () => {
    expect(pollDelay(3 * 60_000)).toBeGreaterThan(FIRST_DELAY_MS);
  });

  it("slows down further for a tab somebody left open", () => {
    // A prejoin abandoned at lunchtime must not run a query every two seconds
    // until the browser is closed.
    expect(pollDelay(30 * 60_000)).toBeGreaterThan(pollDelay(3 * 60_000));
  });

  it("never speeds back up", () => {
    let previous = 0;
    for (let waited = 0; waited <= 60 * 60_000; waited += 10_000) {
      const delay = pollDelay(waited);
      expect(delay).toBeGreaterThanOrEqual(previous);
      previous = delay;
    }
  });

  it("never stops polling altogether", () => {
    expect(pollDelay(24 * 60 * 60_000)).toBeGreaterThan(0);
  });
});

describe("waitingState", () => {
  it("reports the decision once there is one", () => {
    expect(waitingState({ status: "admitted", hostPresent: false })).toBe("admitted");
    expect(waitingState({ status: "denied", hostPresent: true })).toBe("denied");
  });

  it("says the host is gone when nobody is there to admit you", () => {
    // Otherwise this is ten minutes of staring at a spinner.
    expect(waitingState({ status: "pending", hostPresent: false })).toBe("hostGone");
  });

  it("says nothing new when the media server could not be asked", () => {
    // A failed lookup is not an answer. Announcing that the host left because
    // our own call timed out would be worse than saying nothing.
    expect(waitingState({ status: "pending", hostPresent: null })).toBe("waiting");
  });

  it("waits while the host is there", () => {
    expect(waitingState({ status: "pending", hostPresent: true })).toBe("waiting");
  });

  it("lets a decision win over the host having left", () => {
    // Admitted and then the host leaves: you were let in, so go in.
    expect(waitingState({ status: "admitted", hostPresent: false })).toBe("admitted");
    expect(waitingState({ status: "denied", hostPresent: null })).toBe("denied");
  });
});
