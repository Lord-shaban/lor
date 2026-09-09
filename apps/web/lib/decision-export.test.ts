import { describe, expect, it } from "vitest";
import { exportDecisions } from "./decision-export";

describe("decision download", () => {
  it("orders retained evidence, keeps mixed-script wording, and uses UTC LF text", () => {
    const records = [
      {
        text: "Publish after the security review.",
        source: {
          seq: 7,
          speaker: "Sarah",
          quote: "We will publish after the security review.",
          at: "2026-09-08T15:01:00+03:00",
        },
      },
      {
        text: "اعتماد الـ release بعد نجاح الـ CI.",
        source: {
          seq: 2,
          speaker: "أحمد\r\n",
          quote: "Deploy خلص على الـ server.\r\nالـ CI أخضر.",
          at: new Date("2026-09-08T12:00:00Z"),
        },
      },
    ];

    expect(exportDecisions(records)).toBe(
      "[2026-09-08T12:00:00.000Z] أحمد\n\n" +
      "Decision: اعتماد الـ release بعد نجاح الـ CI.\n" +
      "Evidence: Deploy خلص على الـ server.\nالـ CI أخضر.\n\n" +
      "[2026-09-08T12:01:00.000Z] Sarah\n" +
      "Decision: Publish after the security review.\n" +
      "Evidence: We will publish after the security review.",
    );
    expect(records[0].source.seq).toBe(7);
  });

  it("has no invented content when the room has no confirmed decisions", () => {
    expect(exportDecisions([])).toBe("");
  });
});
