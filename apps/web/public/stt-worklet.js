/**
 * Twenty milliseconds of microphone at a time, on the audio thread.
 *
 * An AudioWorklet rather than a ScriptProcessor or an analyser polled from a
 * frame callback. Both alternatives run on the main thread, where a busy render
 * drops audio quanta outright — and a voice-activity detector fed a stream with
 * holes in it hears silence where somebody was talking. This runs on the audio
 * thread, which is real-time and does not wait for React.
 *
 * It must live in `public/` rather than beside the module that uses it: an
 * AudioWorklet is fetched by URL at runtime, not imported, so a bundler would
 * only see a string. `capture.ts` loads it from `/stt-worklet.js`.
 *
 * Nothing is written to the outputs, so the node is silent by construction. The
 * decision about what any of this *means* is in `lib/stt/vad.ts`, on the main
 * thread, where it can be tested without an audio context.
 */

/** The detector's frame. Long enough to have an energy, short enough to place. */
const FRAME_MS = 20;

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // `sampleRate` is a global in this scope, and is whatever the context was
    // actually given rather than what it was asked for.
    this.frameSize = Math.round((sampleRate * FRAME_MS) / 1000);
    this.frame = new Float32Array(this.frameSize);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];

    // No input yet, or the track ended. Staying alive costs nothing and means
    // a muted moment does not tear the node down.
    if (!channel) return true;

    let read = 0;
    while (read < channel.length) {
      const take = Math.min(this.frameSize - this.filled, channel.length - read);
      this.frame.set(channel.subarray(read, read + take), this.filled);
      this.filled += take;
      read += take;

      if (this.filled === this.frameSize) {
        // A copy, transferred. The frame is reused for the next twenty
        // milliseconds, so handing the same buffer over would have the main
        // thread reading audio that is being overwritten underneath it.
        const out = this.frame.slice();
        this.port.postMessage(out, [out.buffer]);
        this.filled = 0;
      }
    }

    return true;
  }
}

registerProcessor("lor-capture", CaptureProcessor);
