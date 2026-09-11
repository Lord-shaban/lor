import { describe, expect, it } from "vitest";
import {
  MAX_MANUAL_MOMENT_LABEL_LENGTH,
  capturedSpeechTotals,
  readManualMomentLabel,
} from "./timeline";

describe("manual timeline moment input", () => {
  it("allows an unlabeled or concise participant label", () => {
    expect(readManualMomentLabel(undefined)).toEqual({ kind: "valid", label: null });
    expect(readManualMomentLabel("  قرار مهم  ")).toEqual({
      kind: "valid",
      label: "قرار مهم",
    });
    expect(readManualMomentLabel("   ")).toEqual({ kind: "valid", label: null });
  });

  it("rejects values that cannot be safely kept as a marker label", () => {
    expect(readManualMomentLabel({ label: "forged" })).toEqual({ kind: "invalid" });
    expect(readManualMomentLabel("x".repeat(MAX_MANUAL_MOMENT_LABEL_LENGTH + 1))).toEqual({
      kind: "invalid",
    });
  });
});

describe("captured speech totals", () => {
  it("adds retained VAD spans by canonical identity and keeps the latest name snapshot", () => {
    expect(
      capturedSpeechTotals([
        { identity: "p-sara", name: "Sara", durationMs: 1_200 },
        { identity: "p-ahmed", name: "أحمد", durationMs: 4_000 },
        { identity: "p-sara", name: "سارة", durationMs: 1_100 },
      ]),
    ).toEqual([
      { identity: "p-ahmed", name: "أحمد", durationMs: 4_000 },
      { identity: "p-sara", name: "سارة", durationMs: 2_300 },
    ]);
  });

  it("does not manufacture totals for people with no retained caption line", () => {
    expect(capturedSpeechTotals([])).toEqual([]);
  });
});
