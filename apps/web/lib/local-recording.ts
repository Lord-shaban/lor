/**
 * Browser capability checks and names for local meeting recordings.
 *
 * This module deliberately has no LiveKit, network, or storage dependency.
 * A WebM is assembled by the browser in the participant's tab; only the
 * small started/stopped announcement travels over the room data channel.
 */

export const WEBM_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const;

/** Choose the best WebM container the current browser promises to encode. */
export function supportedWebmMimeType(
  isTypeSupported: (mimeType: string) => boolean,
): string | null {
  return WEBM_MIME_TYPES.find(isTypeSupported) ?? null;
}

/**
 * A filename people can recognise later without putting a room code or a
 * participant name into their downloads folder.
 */
export function recordingFilename(at: Date): string {
  const stamp = at.toISOString().replace(/[:.]/g, "-").replace("T", "-").replace("Z", "");
  return `lor-recording-${stamp}.webm`;
}
