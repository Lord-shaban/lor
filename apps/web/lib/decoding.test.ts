import { describe, expect, it } from "vitest";
import { STALL_MS, decodingOf, look } from "./decoding";

function video(state: {
  width: number;
  ready: number;
  time: number;
  frames: number;
}) {
  const element = state as unknown as HTMLVideoElement & typeof state;
  Object.defineProperties(element, {
    videoWidth: { get: () => state.width },
    readyState: { get: () => state.ready },
    currentTime: { get: () => state.time },
    getVideoPlaybackQuality: {
      value: () => ({ totalVideoFrames: state.frames }) as VideoPlaybackQuality,
    },
  });
  return element;
}

describe("look", () => {
  it("says no before a frame has arrived", () => {
    expect(look(video({ width: 0, ready: 0, time: 0, frames: 0 }), 0)).toBe(false);
  });

  it("says yes once frames arrive and keep advancing", () => {
    const state = { width: 640, ready: 2, time: 0.5, frames: 1 };
    const element = video(state);

    expect(look(element, 1_000)).toBe(true);
    state.time = 1.5;
    state.frames = 31;
    expect(look(element, 2_000)).toBe(true);
  });

  it("goes back to no when the sender freezes", () => {
    // The MediaStream timeline advances, but the frame counter does not.
    const state = { width: 640, ready: 2, time: 4, frames: 120 };
    const element = video(state);

    expect(look(element, 0)).toBe(true);
    state.time = 6;
    expect(look(element, STALL_MS - 1)).toBe(true);
    state.time = 7;
    expect(look(element, STALL_MS + 1)).toBe(false);
  });

  it("comes back when the picture does", () => {
    const state = { width: 640, ready: 2, time: 4, frames: 120 };
    const element = video(state);

    look(element, 0);
    expect(look(element, STALL_MS + 1)).toBe(false);

    state.time = 4.2;
    state.frames = 121;
    expect(look(element, STALL_MS + 100)).toBe(true);
  });

  it("is not fooled by the size a detached element keeps", () => {
    expect(look(video({ width: 640, ready: 0, time: 9, frames: 270 }), 0)).toBe(false);
  });

  it("does not carry a decoded frame into a replacement track", () => {
    const state = { width: 640, ready: 2, time: 1, frames: 30 };
    const element = video(state);
    const firstTrack = {};
    const replacementTrack = {};

    expect(look(element, 0, firstTrack)).toBe(true);
    expect(decodingOf(element, replacementTrack)).toBe(false);
    // The element still reports the old track's dimensions and frame count.
    expect(look(element, 1, replacementTrack)).toBe(false);

    state.frames = 31;
    expect(look(element, 2, replacementTrack)).toBe(true);
  });
});
