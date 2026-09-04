/**
 * The recent past of a microphone, kept so an utterance can start before we
 * knew it had.
 *
 * `vad.ts` reports a boundary a few hundred milliseconds after the sound that
 * caused it — an onset is only detectable once it has happened. Its answer is
 * therefore a span reaching backwards, and the only way to honour that is to
 * have been keeping the audio all along.
 *
 * Twenty-five seconds at sixteen kilohertz is 1.6 MB of `Float32Array`, sized
 * once and never reallocated. It has to be a class: everything else in `lib/`
 * is a pure function over small values, and this is a mutable buffer written to
 * every eight milliseconds. A functional version would copy a megabyte per
 * audio quantum.
 *
 * The one thing it must never do is answer a question about audio it has
 * already overwritten. A ring that quietly returns whatever is at those indices
 * hands the transcriber a sentence spliced from two different moments, which is
 * far worse than a gap — so `read` returns `null` and the caller decides.
 */

export class AudioRing {
  readonly sampleRate: number;
  private readonly samples: Float32Array;
  /** Samples written since the beginning, which is also the write cursor. */
  private written = 0;

  constructor(sampleRate: number, capacityMs: number) {
    this.sampleRate = sampleRate;
    this.samples = new Float32Array(Math.ceil((capacityMs / 1000) * sampleRate));
  }

  /** How much audio it can hold before the oldest is lost. */
  get capacityMs(): number {
    return (this.samples.length / this.sampleRate) * 1000;
  }

  /** Milliseconds of audio seen since the start. Also "now". */
  get writtenMs(): number {
    return (this.written / this.sampleRate) * 1000;
  }

  /** The oldest moment still held. */
  get earliestMs(): number {
    return Math.max(0, this.writtenMs - this.capacityMs);
  }

  write(block: Float32Array): void {
    const size = this.samples.length;

    // A block longer than the ring can only leave its tail behind, and pausing
    // a tab then resuming it delivers exactly that. Take the last `size`
    // samples rather than wrapping repeatedly over ourselves.
    const dropped = Math.max(0, block.length - size);
    const source = dropped > 0 ? block.subarray(dropped) : block;

    // Offset by what was dropped as well as by what was written, so a sample
    // always sits at its own absolute index modulo the size. Skipping this is
    // how a truncated write silently rotates everything that follows it.
    const offset = (this.written + dropped) % size;
    const untilEnd = size - offset;

    if (source.length <= untilEnd) {
      this.samples.set(source, offset);
    } else {
      this.samples.set(source.subarray(0, untilEnd), offset);
      this.samples.set(source.subarray(untilEnd), 0);
    }

    // The count advances by what arrived, not by what was kept: `writtenMs` is
    // a clock, and dropping samples must not make time run slow.
    this.written += block.length;
  }

  /**
   * The samples covering `[fromMs, toMs)`, or `null` if any of it is gone.
   *
   * A span reaching past the write cursor is clamped to it — the tail of an
   * utterance can legitimately be requested a fraction before it has all
   * arrived, and there is nothing wrong with returning what exists.
   */
  read(fromMs: number, toMs: number): Float32Array | null {
    const size = this.samples.length;

    const from = Math.round((fromMs / 1000) * this.sampleRate);
    const to = Math.min(Math.round((toMs / 1000) * this.sampleRate), this.written);

    if (from < 0 || to <= from) return null;
    // Overwritten. Better to say so than to return a splice of two moments.
    if (this.written - from > size) return null;

    const out = new Float32Array(to - from);
    const start = from % size;
    const untilEnd = size - start;

    if (out.length <= untilEnd) {
      out.set(this.samples.subarray(start, start + out.length));
    } else {
      out.set(this.samples.subarray(start, size));
      out.set(this.samples.subarray(0, out.length - untilEnd), untilEnd);
    }

    return out;
  }
}
