import { describe, expect, it } from "vitest";
import { SAMPLE_RATE, encodeWav, wavDuration } from "./wav";

const text = (bytes: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...bytes.subarray(at, at + length));

const view = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

describe("encodeWav", () => {
  it("writes a header a decoder will recognise", () => {
    const bytes = encodeWav(new Float32Array(100));
    const dv = view(bytes);

    expect(text(bytes, 0, 4)).toBe("RIFF");
    expect(text(bytes, 8, 4)).toBe("WAVE");
    expect(text(bytes, 12, 4)).toBe("fmt ");
    expect(text(bytes, 36, 4)).toBe("data");

    expect(dv.getUint16(20, true)).toBe(1); // uncompressed PCM
    expect(dv.getUint16(22, true)).toBe(1); // mono
    expect(dv.getUint32(24, true)).toBe(SAMPLE_RATE);
    expect(dv.getUint16(34, true)).toBe(16); // bits per sample
  });

  it("states its own lengths correctly", () => {
    // Most readers ignore these and infer from the file size. The ones that do
    // not are the ones that reject the file, so they have to agree.
    const samples = new Float32Array(1000);
    const bytes = encodeWav(samples);
    const dv = view(bytes);

    expect(bytes.length).toBe(44 + samples.length * 2);
    expect(dv.getUint32(4, true)).toBe(bytes.length - 8);
    expect(dv.getUint32(40, true)).toBe(samples.length * 2);
    expect(dv.getUint32(28, true)).toBe(SAMPLE_RATE * 2); // byte rate
    expect(dv.getUint16(32, true)).toBe(2); // block align
  });

  it("carries the samples through", () => {
    const samples = Float32Array.from([0, 0.5, -0.5, 1, -1]);
    const dv = view(encodeWav(samples));

    expect(dv.getInt16(44, true)).toBe(0);
    expect(dv.getInt16(46, true)).toBeCloseTo(0x7fff / 2, -1);
    expect(dv.getInt16(48, true)).toBeCloseTo(-0x7fff / 2, -1);
    expect(dv.getInt16(50, true)).toBe(0x7fff);
    expect(dv.getInt16(52, true)).toBe(-0x7fff);
  });

  it("clamps rather than wraps", () => {
    // A sample above full scale is a loud moment. Letting it overflow makes it
    // a loud moment in the opposite direction — an audible click, and to a
    // transcriber a consonant nobody said.
    const dv = view(encodeWav(Float32Array.from([2, -2, 1.0001])));

    expect(dv.getInt16(44, true)).toBe(0x7fff);
    expect(dv.getInt16(46, true)).toBe(-0x7fff);
    expect(dv.getInt16(48, true)).toBe(0x7fff);
  });

  it("takes a rate other than the default", () => {
    const dv = view(encodeWav(new Float32Array(10), 48_000));
    expect(dv.getUint32(24, true)).toBe(48_000);
    expect(dv.getUint32(28, true)).toBe(96_000);
  });

  it("encodes an empty span as a valid, empty file", () => {
    const bytes = encodeWav(new Float32Array(0));
    expect(bytes.length).toBe(44);
    expect(view(bytes).getUint32(40, true)).toBe(0);
  });

  it("is little-endian, which is what the format says", () => {
    // Written by hand rather than by a library, so the one thing that would
    // silently produce noise instead of an error is worth pinning.
    const dv = view(encodeWav(Float32Array.from([1 / 256])));
    expect(dv.getUint8(44)).toBe(0x80);
    expect(dv.getUint8(45)).toBe(0x00);
  });
});

describe("wavDuration", () => {
  const header = (bytes: Uint8Array): ArrayBuffer =>
    new Uint8Array(bytes.subarray(0, 4096)).buffer;

  it("reads the length out of the header alone", () => {
    // Forty-four bytes, not the whole utterance: this is what a quota is
    // charged against, and buffering a megabyte to ask would defeat the point.
    const seconds = 2.5;
    const bytes = encodeWav(new Float32Array(SAMPLE_RATE * seconds));
    expect(wavDuration(header(bytes))).toBeCloseTo(seconds, 5);
  });

  it("works at a rate other than the default", () => {
    const bytes = encodeWav(new Float32Array(48_000), 48_000);
    expect(wavDuration(header(bytes))).toBeCloseTo(1, 5);
  });

  it("is zero for an empty file, not null", () => {
    expect(wavDuration(header(encodeWav(new Float32Array(0))))).toBe(0);
  });

  it("refuses bytes that are not a WAV", () => {
    // A quota that silently charges nothing for whatever it cannot parse is
    // not a quota.
    expect(wavDuration(new ArrayBuffer(44))).toBeNull();
    expect(wavDuration(new ArrayBuffer(10))).toBeNull();

    const notWave = new Uint8Array(encodeWav(new Float32Array(100)));
    notWave.set(new TextEncoder().encode("OGGS"), 8);
    expect(wavDuration(header(notWave))).toBeNull();
  });
  it("finds the length in a file that is not the canonical forty-four bytes", () => {
    // The case that actually happened. Windows' speech synthesiser writes an
    // extra chunk before `data`, so the number at offset 40 belongs to
    // something else — and reading it charged a five-second recording as
    // 228,855 seconds of quota.
    const canonical = encodeWav(new Float32Array(SAMPLE_RATE)); // one second
    const extra = new TextEncoder().encode("fact");

    const padded = new Uint8Array(canonical.length + 12);
    padded.set(canonical.subarray(0, 36), 0); // through the fmt chunk
    padded.set(extra, 36);
    new DataView(padded.buffer).setUint32(40, 4, true); // its length
    new DataView(padded.buffer).setUint32(44, 12345, true); // its contents
    padded.set(canonical.subarray(36), 48); // then the real data chunk

    // Reading offset 40 blind would find the `fact` chunk's length, not the
    // audio's.
    expect(wavDuration(header(padded))).toBeCloseTo(1, 5);
  });
});
