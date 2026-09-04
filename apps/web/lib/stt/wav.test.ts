import { describe, expect, it } from "vitest";
import { SAMPLE_RATE, encodeWav } from "./wav";

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
