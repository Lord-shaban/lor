import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUOTA,
  WARN_AT,
  quotaLimits,
  shouldWarn,
  tightest,
} from "./quota";

describe("quotaLimits", () => {
  it("has all three ceilings with nothing configured", () => {
    expect(quotaLimits({})).toEqual([
      { scope: "user", seconds: DEFAULT_QUOTA.user },
      { scope: "room", seconds: DEFAULT_QUOTA.room },
      { scope: "global", seconds: DEFAULT_QUOTA.global },
    ]);
  });

  it("checks the narrowest first", () => {
    // So the message names the limit the caller can do something about. Being
    // told the server is out, when it is your own fifteen minutes that ran out,
    // sends you to the wrong place.
    expect(quotaLimits({}).map((l) => l.scope)).toEqual(["user", "room", "global"]);
  });

  it("takes the operator's numbers", () => {
    const limits = quotaLimits({
      LOR_FREE_STT_SECONDS_PER_USER_PER_DAY: "60",
      LOR_FREE_STT_SECONDS_PER_ROOM_PER_DAY: "120",
      LOR_FREE_STT_SECONDS_GLOBAL_PER_DAY: "240",
    });

    expect(limits.map((l) => l.seconds)).toEqual([60, 120, 240]);
  });

  it("treats zero as no ceiling at all", () => {
    // An operator paying for the key should not have to invent a large number
    // to stop it being rationed.
    const limits = quotaLimits({ LOR_FREE_STT_SECONDS_PER_USER_PER_DAY: "0" });
    expect(limits.map((l) => l.scope)).toEqual(["room", "global"]);
  });

  it("switches everything off when every ceiling is zero", () => {
    expect(
      quotaLimits({
        LOR_FREE_STT_SECONDS_PER_USER_PER_DAY: "0",
        LOR_FREE_STT_SECONDS_PER_ROOM_PER_DAY: "0",
        LOR_FREE_STT_SECONDS_GLOBAL_PER_DAY: "0",
      }),
    ).toEqual([]);
  });

  it("falls back to the default rather than to no limit on a typo", () => {
    // The failure that matters: a mistyped variable must not silently remove a
    // ceiling, because zero is the setting that means "unlimited".
    for (const value of ["nine hundred", "", "   ", "-5", "NaN"]) {
      const [user] = quotaLimits({ LOR_FREE_STT_SECONDS_PER_USER_PER_DAY: value });
      expect(user.seconds, `for ${JSON.stringify(value)}`).toBe(DEFAULT_QUOTA.user);
    }
  });

  it("takes whole seconds", () => {
    const [user] = quotaLimits({ LOR_FREE_STT_SECONDS_PER_USER_PER_DAY: "90.7" });
    expect(user.seconds).toBe(90);
  });
});

describe("shouldWarn", () => {
  it("warns before the wall, not at it", () => {
    // A room told at eighty per cent can fetch a key; one told at a hundred
    // has already lost its captions mid-meeting.
    expect(shouldWarn({ scope: "user", limit: 900, remaining: 900 })).toBe(false);
    expect(shouldWarn({ scope: "user", limit: 900, remaining: 500 })).toBe(false);
    expect(shouldWarn({ scope: "user", limit: 900, remaining: 900 * WARN_AT })).toBe(true);
    expect(shouldWarn({ scope: "user", limit: 900, remaining: 30 })).toBe(true);
    expect(shouldWarn({ scope: "user", limit: 900, remaining: 0 })).toBe(true);
  });

  it("says nothing about a limit that is not a limit", () => {
    expect(shouldWarn({ scope: "user", limit: 0, remaining: 0 })).toBe(false);
  });
});

describe("tightest", () => {
  it("reports whichever has least left as a share of its own ceiling", () => {
    // Not the smallest number: sixty seconds left of a global five hours is
    // more urgent than sixty left of a personal fifteen minutes, and the
    // message has to name the one that will actually stop them.
    const worst = tightest([
      { scope: "user", limit: 900, remaining: 450 },
      { scope: "global", limit: 18_000, remaining: 900 },
    ]);

    expect(worst?.scope).toBe("global");
  });

  it("has nothing to report when nothing is limited", () => {
    expect(tightest([])).toBeNull();
  });
});
