"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { LocalRecordingPlayback } from "./use-local-recording";

/**
 * A deliberately small player for an object URL that exists only in this tab.
 * It never autoplays: selecting a Timeline moment sets the position, then the
 * participant decides whether to play the local file.
 */
export function TimelineRecordingPlayer({
  playback,
  offsetMs,
  selectedTime,
  onClose,
  onUnavailable,
}: {
  playback: LocalRecordingPlayback;
  offsetMs: number;
  selectedTime: string;
  onClose: () => void;
  onUnavailable: () => void;
}) {
  const t = useTranslations("call.timeline.localRecording");
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    // The parent may replace or unmount this player at any point. Releasing
    // here makes the URL lifetime match the rendered media resource exactly.
    return () => playback.release();
  }, [playback]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const targetSeconds = offsetMs / 1_000;
    let seekTimeout: number | undefined;
    let seeking = false;
    const unavailable = () => {
      if (seekTimeout !== undefined) window.clearTimeout(seekTimeout);
      onUnavailable();
    };
    const confirmSeek = () => {
      if (!seeking) return;
      // MediaRecorder WebMs frequently report an infinite duration even when
      // their seekable data is complete. Trust a completed native seek, not a
      // made-up duration; a clamped or failed seek remains unavailable.
      if (Math.abs(video.currentTime - targetSeconds) > 0.25) {
        unavailable();
        return;
      }
      if (seekTimeout !== undefined) window.clearTimeout(seekTimeout);
      setReady(true);
    };
    const seek = () => {
      const durationMs = Math.floor(video.duration * 1_000);
      if (
        !Number.isFinite(targetSeconds)
        || targetSeconds < 0
        || (Number.isFinite(durationMs) && (durationMs <= 0 || offsetMs > durationMs))
      ) {
        unavailable();
        return;
      }
      try {
        seeking = true;
        // The Recorder timestamps are already bounded by the local file. A
        // finite media duration adds another boundary when the browser has it;
        // an infinite WebM duration must instead be confirmed by `seeked`.
        video.currentTime = targetSeconds;
        if (targetSeconds === 0 && video.currentTime === 0) {
          confirmSeek();
          return;
        }
        seekTimeout = window.setTimeout(unavailable, 5_000);
      } catch {
        unavailable();
      }
    };

    video.addEventListener("seeked", confirmSeek);
    video.addEventListener("error", unavailable, { once: true });
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      seek();
    } else {
      video.addEventListener("loadedmetadata", seek, { once: true });
    }
    return () => {
      video.removeEventListener("loadedmetadata", seek);
      video.removeEventListener("seeked", confirmSeek);
      video.removeEventListener("error", unavailable);
      if (seekTimeout !== undefined) window.clearTimeout(seekTimeout);
    };
  }, [offsetMs, onUnavailable]);

  return (
    <section
      data-testid="timeline-local-recording"
      className="mb-5 rounded-lg border border-[#52525b] bg-[#18181b] p-3"
      aria-labelledby="timeline-local-recording-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="timeline-local-recording-title" className="text-sm font-medium text-[#f4f4f5]">
            {t("title")}
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#a1a1aa]">{t("intro")}</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="min-h-11 shrink-0 rounded-md px-3 text-sm font-medium text-[#d4d4d8] underline decoration-[#71717a] underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
        >
          {t("close")}
        </button>
      </div>

      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        src={playback.url}
        className="mt-3 max-h-52 w-full rounded-md bg-black"
      />

      <p aria-live="polite" className="mt-2 text-xs leading-relaxed text-[#d4d4d8]">
        {ready ? t("selected", { time: selectedTime }) : t("loading")}
      </p>
    </section>
  );
}
