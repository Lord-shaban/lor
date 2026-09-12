import { describe, expect, it } from "vitest";
import {
  MAX_MEMORY_ACTION_ITEMS,
  MAX_MEMORY_DECISIONS,
  MAX_MEMORY_REPEATED_SPEAKERS,
  repeatedSpeakerLabel,
} from "./meeting-memory";

describe("meeting-memory contract", () => {
  it("labels only names retained in more than one completed occurrence as repeated", () => {
    expect(repeatedSpeakerLabel(0)).toBe("single");
    expect(repeatedSpeakerLabel(1)).toBe("single");
    expect(repeatedSpeakerLabel(2)).toBe("repeated");
  });

  it("keeps every on-demand collection deliberately bounded", () => {
    expect(MAX_MEMORY_DECISIONS).toBeGreaterThan(0);
    expect(MAX_MEMORY_ACTION_ITEMS).toBeGreaterThan(0);
    expect(MAX_MEMORY_REPEATED_SPEAKERS).toBeGreaterThan(0);
  });
});
