/**
 * How much video this device is willing to send and receive.
 *
 * A meeting on mobile data is the design target here, not a degraded edge case.
 * Video is almost all of the bandwidth in a call and audio is almost all of the
 * meeting, so the useful control is not a quality slider — it is a way to spend
 * less on video without losing the conversation.
 *
 * Kept apart from the component that applies it because the effects table below
 * is the specification: each mode says exactly what it does to what you receive
 * and what you send, and the reasons it does not do more are as load-bearing as
 * the reasons it does.
 */

export const VIDEO_MODES = ["auto", "low", "off"] as const;
export type VideoMode = (typeof VIDEO_MODES)[number];

export interface VideoModeEffect {
  /**
   * Whether to stay subscribed to other people's video at all.
   *
   * False means unsubscribing rather than hiding: a hidden video still arrives,
   * and arriving is the expensive part.
   */
  receiveVideo: boolean;

  /**
   * The highest simulcast layer to ask for, or `"adaptive"` to let the client's
   * own adaptive-stream logic choose.
   *
   * Never a floor. The server drops below this whenever the connection cannot
   * hold it, which is why there is no "high" mode: a quality the connection
   * cannot sustain is a promise the server overrides within seconds, and a
   * control that does nothing is worse than no control.
   */
  maxLayer: "adaptive" | "low";

  /**
   * Whether this device should keep its own camera on.
   *
   * Only turned off for audio-only. `"low"` deliberately leaves publishing
   * alone: with dynacast, the server already stops relaying the layers nobody
   * is watching, so a room where everyone chose `"low"` costs the sender the
   * low layer and nothing else. Republishing at a smaller resolution would
   * blink everybody's tile to buy what is already free.
   */
  publishCamera: boolean;
}

const EFFECTS: Record<VideoMode, VideoModeEffect> = {
  auto: { receiveVideo: true, maxLayer: "adaptive", publishCamera: true },
  low: { receiveVideo: true, maxLayer: "low", publishCamera: true },
  off: { receiveVideo: false, maxLayer: "adaptive", publishCamera: false },
};

export function effectOf(mode: VideoMode): VideoModeEffect {
  return EFFECTS[mode];
}

/**
 * What the camera should be after a mode change, or `null` to leave it alone.
 *
 * The rule that matters is the second one: coming back from audio-only must not
 * switch on the camera of somebody who had it off before they got there. Muting
 * someone is recoverable; turning a stranger's camera on for them is not.
 */
export function cameraForModeChange({
  next,
  previous,
  cameraBeforeAudioOnly,
}: {
  next: VideoMode;
  previous: VideoMode;
  /** Whether the camera was on at the moment audio-only was entered. */
  cameraBeforeAudioOnly: boolean;
}): boolean | null {
  if (next === previous) return null;
  if (next === "off") return false;
  if (previous === "off") return cameraBeforeAudioOnly;
  return null;
}
