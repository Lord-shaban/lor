import { describe, expect, it } from "vitest";
import {
  WEBM_MIME_TYPES,
  recordingFilename,
  supportedWebmMimeType,
} from "./local-recording";

describe("supportedWebmMimeType", () => {
  it("prefers VP9 when the browser can encode it", () => {
    expect(supportedWebmMimeType((type) => type === WEBM_MIME_TYPES[0])).toBe(
      "video/webm;codecs=vp9,opus",
    );
  });

  it("falls back through the WebM choices without choosing another container", () => {
    expect(supportedWebmMimeType((type) => type === "video/webm")).toBe("video/webm");
    expect(supportedWebmMimeType(() => false)).toBeNull();
  });
});

describe("recordingFilename", () => {
  it("is a WebM name without room or participant data", () => {
    expect(recordingFilename(new Date("2026-09-09T12:34:56.789Z"))).toBe(
      "lor-recording-2026-09-09-12-34-56-789.webm",
    );
  });
});
