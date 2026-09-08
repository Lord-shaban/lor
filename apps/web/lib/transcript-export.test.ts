import { describe, expect, it } from "vitest";
import { exportTranscript } from "./transcript-export";

describe("transcript download", () => {
  it("keeps attribution, UTC time and mixed-language words in server order", () => {
    const lines = [
      { seq: 1, speaker: "Sarah", text: "هراجع الـ pull request 🎉", at: "2026-09-08T15:01:00+03:00" },
      { seq: 0, speaker: "أحمد", text: "Deploy خلص على الـ server.", at: new Date("2026-09-08T12:00:00Z") },
    ];
    expect(exportTranscript(lines)).toBe(
      "[2026-09-08T12:00:00.000Z] أحمد: Deploy خلص على الـ server.\n" +
      "[2026-09-08T12:01:00.000Z] Sarah: هراجع الـ pull request 🎉",
    );
    expect(lines[0].seq).toBe(1);
  });

  it("has no invented content for an empty record", () => {
    expect(exportTranscript([])).toBe("");
  });
});
