/**
 * Turning a span of samples into a file a transcription API will accept.
 *
 * WAV rather than the browser's own `MediaRecorder` output, which would be
 * Opus in a WebM container. That looks like the obvious choice — it is smaller
 * on the wire and the browser encodes it for free — and it is the wrong one
 * here for a specific reason: a WebM stream is only decodable from its header,
 * so cutting an utterance out of the middle means keeping the first chunk
 * forever and gluing it in front of a run of clusters, and hoping the boundary
 * lands where the decoder expects. Every "why is the first word missing" bug in
 * a transcription pipeline starts there.
 *
 * A span of PCM has no such problem. It begins where we say it begins, to the
 * sample, which is exactly what the pre-roll in `vad.ts` is for. Sixteen
 * kilohertz mono at sixteen bits is 32 KB a second: a ten-second utterance is
 * 320 KB, against a 25 MB request limit. The bandwidth is not the constraint;
 * the first consonant is.
 */

/** The only rate anything here uses — and the one Whisper resamples to anyway. */
export const SAMPLE_RATE = 16_000;

const HEADER_BYTES = 44;
const BITS_PER_SAMPLE = 16;
const CHANNELS = 1;

/** Signed 16-bit full scale. */
const FULL_SCALE = 0x7fff;

/**
 * `Uint8Array<ArrayBuffer>`, not the default `Uint8Array<ArrayBufferLike>`. The
 * buffer here is a real `ArrayBuffer`, and only the narrower type is accepted
 * as a `BlobPart` — the wider one could be backed by a `SharedArrayBuffer`.
 */
export function encodeWav(
  samples: Float32Array,
  sampleRate: number = SAMPLE_RATE,
): Uint8Array<ArrayBuffer> {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);

  const byteRate = sampleRate * CHANNELS * (BITS_PER_SAMPLE / 8);

  ascii(view, 0, "RIFF");
  // Everything after this field. A reader that trusts it and a reader that
  // ignores it should agree, so it has to be right even though most do ignore
  // it.
  view.setUint32(4, 36 + dataBytes, true);
  ascii(view, 8, "WAVE");

  ascii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk length
  view.setUint16(20, 1, true); // 1 = uncompressed PCM
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, CHANNELS * (BITS_PER_SAMPLE / 8), true); // block align
  view.setUint16(34, BITS_PER_SAMPLE, true);

  ascii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i++) {
    // Clamped, not wrapped. A sample above full scale is a loud moment; letting
    // it overflow turns it into a loud moment in the opposite direction, which
    // is an audible click and, to a transcriber, a consonant that was not said.
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(HEADER_BYTES + i * 2, Math.round(clamped * FULL_SCALE), true);
  }

  return new Uint8Array(buffer);
}

function ascii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
