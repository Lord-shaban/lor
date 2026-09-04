import { describe, expect, it } from "vitest";
import {
  VIDEO_MODES,
  cameraForModeChange,
  effectOf,
  type VideoMode,
} from "./video-mode";

describe("the modes", () => {
  it("covers every mode with an effect", () => {
    for (const mode of VIDEO_MODES) {
      expect(effectOf(mode)).toBeDefined();
    }
  });

  it("starts at auto", () => {
    // The first entry is what a call opens in, and a call must open showing
    // people to each other.
    expect(VIDEO_MODES[0]).toBe("auto");
    expect(effectOf("auto")).toEqual({
      receiveVideo: true,
      maxLayer: "adaptive",
      publishCamera: true,
    });
  });

  it("caps the layer in low without touching what you publish", () => {
    // Dynacast already stops relaying layers nobody is watching, so capping
    // what you receive is the whole saving; republishing would blink every
    // tile to buy something that is already free.
    expect(effectOf("low")).toEqual({
      receiveVideo: true,
      maxLayer: "low",
      publishCamera: true,
    });
  });

  it("stops receiving and stops publishing in audio-only", () => {
    expect(effectOf("off")).toEqual({
      receiveVideo: false,
      maxLayer: "adaptive",
      publishCamera: false,
    });
  });

  it("has no mode that forces video higher than the connection allows", () => {
    // There is deliberately no "high": the server drops below any cap whenever
    // the connection cannot hold it, so such a control would do nothing.
    for (const mode of VIDEO_MODES) {
      expect(effectOf(mode).maxLayer).not.toBe("high");
    }
  });
});

describe("cameraForModeChange", () => {
  const change = (
    previous: VideoMode,
    next: VideoMode,
    cameraBeforeAudioOnly = true,
  ) => cameraForModeChange({ next, previous, cameraBeforeAudioOnly });

  it("turns the camera off on the way into audio-only", () => {
    expect(change("auto", "off")).toBe(false);
    expect(change("low", "off")).toBe(false);
  });

  it("restores a camera that was on before audio-only", () => {
    expect(change("off", "auto", true)).toBe(true);
    expect(change("off", "low", true)).toBe(true);
  });

  it("does not switch on a camera that was already off", () => {
    // The rule that matters. Muting somebody is recoverable; turning their
    // camera on for them is not.
    expect(change("off", "auto", false)).toBe(false);
    expect(change("off", "low", false)).toBe(false);
  });

  it("leaves the camera alone between the two video modes", () => {
    expect(change("auto", "low")).toBeNull();
    expect(change("low", "auto")).toBeNull();
  });

  it("does nothing when the mode has not changed", () => {
    for (const mode of VIDEO_MODES) {
      expect(change(mode, mode)).toBeNull();
      expect(change(mode, mode, false)).toBeNull();
    }
  });
});
