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

  it("treats zero as a ceiling of nothing, not the absence of one", () => {
    // `.env.example` has promised since v0.0 that zero means "disable your key
    // entirely and require BYOK". The first version of this file dropped the
    // ceiling instead — so an operator following the documentation to *stop*
    // giving their key away would have given it away without limit. This test
    // exists so that cannot happen quietly again.
    const limits = quotaLimits({ LOR_FREE_STT_SECONDS_PER_USER_PER_DAY: "0" });

    expect(limits.map((l) => l.scope)).toEqual(["user", "room", "global"]);
    expect(limits[0]).toEqual({ scope: "user", seconds: 0 });
  });

  it("keeps every ceiling when they are all zero", () => {
    const limits = quotaLimits({
      LOR_FREE_STT_SECONDS_PER_USER_PER_DAY: "0",
      LOR_FREE_STT_SECONDS_PER_ROOM_PER_DAY: "0",
      LOR_FREE_STT_SECONDS_GLOBAL_PER_DAY: "0",
    });

    expect(limits.every((l) => l.seconds === 0)).toBe(true);
    expect(limits).toHaveLength(3);
  });

  it("has no value meaning unlimited", () => {
    // Deliberate. A second magic number is how the first one went unnoticed;
    // an operator who does not want rationing sets a large one.
    const [user] = quotaLimits({ LOR_FREE_STT_SECONDS_PER_USER_PER_DAY: "999999" });
    expect(user.seconds).toBe(999999);
  });

  it("falls back to the default rather than to no limit on a typo", () => {
    // The failure that matters: a mistyped variable must not silently remove a
    // ceiling, because zero is the setting that means "unlimited".
    // Neither direction: a typo must not remove a ceiling and must not refuse
    // everybody either. Both are worse than the default.
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
