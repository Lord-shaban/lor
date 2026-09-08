// A subscription is not proof of a picture. Dimensions + readyState prove the
// first frame; totalVideoFrames proves that new ones keep arriving. currentTime
// cannot do that because a MediaStream timeline advances through a frame stall.

/** How long the presented-frame count may stand still before the picture is stale. */
export const STALL_MS = 2_500;

interface Watch {
  source: object | undefined;
  decoding: boolean;
  drawable: boolean;
  lastFrames: number;
  lastFrameAt: number | null;
}

const watches = new WeakMap<HTMLVideoElement, Watch>();

export function decodingOf(
  element: HTMLVideoElement,
  source: object | undefined,
): boolean {
  const watch = watches.get(element);
  return watch !== undefined && watch.source === source ? watch.decoding : false;
}

export function look(
  element: HTMLVideoElement,
  now: number,
  source?: object,
): boolean {
  const frames = element.getVideoPlaybackQuality().totalVideoFrames;
  const drawable = element.videoWidth > 0 && element.readyState >= 2;
  const previous = watches.get(element);
  const sourceChanged = previous !== undefined && previous.source !== source;
  const watch =
    previous === undefined || sourceChanged
      ? {
          source,
          decoding: false,
          // Dimensions can still describe the replaced track.
          drawable: sourceChanged ? drawable : false,
          lastFrames: frames,
          lastFrameAt: null,
        }
      : previous;

  if ((!sourceChanged && drawable && !watch.drawable) || frames !== watch.lastFrames) {
    watch.lastFrameAt = now;
  }

  const moving = watch.lastFrameAt !== null && now - watch.lastFrameAt < STALL_MS;
  watch.decoding = drawable && moving;
  watch.drawable = drawable;
  watch.lastFrames = frames;

  watches.set(element, watch);
  return watch.decoding;
}
