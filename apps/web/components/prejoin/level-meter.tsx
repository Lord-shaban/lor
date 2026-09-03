"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * How loud you actually are.
 *
 * The bar is the answer to "is this thing on?", which is the single most common
 * confusion at the start of a call. It reads from the live stream rather than
 * from any track-enabled flag, so a hardware mute switch shows up as silence —
 * which is exactly what the person needs to discover here, not two minutes in.
 */
export function LevelMeter({
  stream,
  label,
  className,
}: {
  stream: MediaStream | null;
  label: string;
  className?: string;
}) {
  const [level, setLevel] = useState(0);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const track = stream?.getAudioTracks()[0];
    // Nothing to measure. The cleanup below resets the bar, so there is no
    // need to write state on the way in.
    if (!stream || !track) return;

    let context: AudioContext | undefined;
    let cancelled = false;

    try {
      context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      // Small window: this is a level indicator, not a spectrum, and a short
      // buffer keeps it responsive to the start of a word.
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);

      const samples = new Float32Array(analyser.fftSize);

      const tick = () => {
        if (cancelled) return;
        analyser.getFloatTimeDomainData(samples);

        // RMS, not peak: peak jumps on a single click and reads as noise.
        let sum = 0;
        for (const sample of samples) sum += sample * sample;
        const rms = Math.sqrt(sum / samples.length);

        // Speech sits low in a linear scale, so a raw RMS bar barely moves.
        // A cube root spreads the quiet end out and makes normal talking fill
        // a useful part of the bar.
        setLevel(Math.min(1, Math.cbrt(rms) * 1.4));

        frame.current = requestAnimationFrame(tick);
      };

      tick();
    } catch {
      // No AudioContext, or the stream ended between the check and the call.
      // The meter simply stays where it is; the rest of the screen still works.
    }

    return () => {
      cancelled = true;
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      // Drop to silence rather than freezing the last reading from a device
      // that is no longer open.
      setLevel(0);
      // Every AudioContext holds an audio thread open. Leaking one per device
      // switch is audible on some machines.
      void context?.close().catch(() => {});
    };
  }, [stream]);

  const segments = 12;
  const lit = Math.round(level * segments);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* The bar is decorative; the number below it is what gets announced. */}
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: segments }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-4 w-1 rounded-full transition-colors duration-75",
              index < lit ? "bg-foreground" : "bg-border",
            )}
          />
        ))}
      </div>

      <span className="sr-only" aria-live="off">
        {label}
      </span>
    </div>
  );
}
