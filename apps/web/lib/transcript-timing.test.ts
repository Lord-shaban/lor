import { describe, expect, it } from "vitest";
import {
  MAX_CAPTURED_SPEECH_MS,
  MIN_CAPTURED_SPEECH_MS,
  readTranscriptTimingRequest,
} from "./transcript-timing";

const occurrenceId = "b9d5200b-27d8-4bb2-aa52-9b80a84136af";

describe("transcript timing requests", () => {
  it("keeps older clients compatible when they send no timing envelope", () => {
    expect(readTranscriptTimingRequest({ text: "legacy line" })).toEqual({
      kind: "none",
    });
  });

  it("accepts a paired, bounded VAD span", () => {
    expect(
      readTranscriptTimingRequest({
        occurrenceId,
        durationMs: MIN_CAPTURED_SPEECH_MS,
      }),
    ).toEqual({ kind: "timeline", occurrenceId, durationMs: MIN_CAPTURED_SPEECH_MS });
    expect(
      readTranscriptTimingRequest({
        occurrenceId,
        durationMs: MAX_CAPTURED_SPEECH_MS,
      }),
    ).toEqual({ kind: "timeline", occurrenceId, durationMs: MAX_CAPTURED_SPEECH_MS });
  });

  it.each([
    { occurrenceId },
    { durationMs: 1_000 },
    { occurrenceId, durationMs: MIN_CAPTURED_SPEECH_MS - 1 },
    { occurrenceId, durationMs: MAX_CAPTURED_SPEECH_MS + 1 },
    { occurrenceId, durationMs: 1_000.5 },
    { occurrenceId: "not-a-uuid", durationMs: 1_000 },
  ])("rejects an incomplete or implausible timing envelope: %o", (body) => {
    expect(readTranscriptTimingRequest(body)).toEqual({ kind: "invalid" });
  });
});
