import { describe, expect, it } from "vitest";
import { recordingOffsetAt } from "./recording-seek";

describe("recordingOffsetAt", () => {
  const range = { startedAt: 1_000, endedAt: 11_000 };

  it("maps a moment inside the completed local file to its bounded offset", () => {
    expect(recordingOffsetAt({ ...range, momentAt: 6_250 })).toEqual({
      kind: "seekable",
      offsetMs: 5_250,
    });
  });

  it("allows the exact start and end without inventing padding", () => {
    expect(recordingOffsetAt({ ...range, momentAt: range.startedAt })).toEqual({
      kind: "seekable",
      offsetMs: 0,
    });
    expect(recordingOffsetAt({ ...range, momentAt: range.endedAt })).toEqual({
      kind: "seekable",
      offsetMs: 10_000,
    });
  });

  it("never clamps a moment outside the actual recording window", () => {
    expect(recordingOffsetAt({ ...range, momentAt: 999 })).toEqual({ kind: "before-recording" });
    expect(recordingOffsetAt({ ...range, momentAt: 11_001 })).toEqual({ kind: "after-recording" });
  });

  it("rejects malformed clocks rather than seeking an arbitrary position", () => {
    expect(recordingOffsetAt({ startedAt: 11_000, endedAt: 1_000, momentAt: 5_000 })).toEqual({ kind: "invalid" });
  });
});
