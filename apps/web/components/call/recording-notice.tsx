"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { LocalRecording } from "./use-local-recording";
import type { RecordingAnnouncement } from "./use-room-messages";

/**
 * The recording's state lives in the tab, so this is intentionally a status
 * strip rather than a room panel. It tells the participant exactly what will
 * happen to their local file without taking space away from the call.
 */
export function RecordingStatus({ recording }: { recording: LocalRecording }) {
  const t = useTranslations("call.recording");
  const elapsed = useElapsed(recording.startedAt);

  if (!recording.supported) {
    return (
      <p
        id="local-recording-status"
        role="status"
        className="border-b border-[#2a2a2e] bg-[#18181b] px-4 py-2 text-center text-sm text-[#d4d4d8]"
      >
        {t("fallback")}
      </p>
    );
  }

  if (recording.status === "idle") {
    if (recording.canStart) return null;
    return (
      <p
        id="local-recording-status"
        role="status"
        className="border-b border-[#2a2a2e] bg-[#18181b] px-4 py-2 text-center text-sm text-[#d4d4d8]"
      >
        {t("needVideo")}
      </p>
    );
  }

  const error = recording.error ? t(`error.${recording.error}`) : null;
  const warning =
    recording.status === "ready" && recording.error
      ? t(`warning.${recording.error}`)
      : null;
  const message =
    recording.status === "recording"
      ? t("active", { elapsed })
      : recording.status === "stopping"
        ? t("saving")
        : recording.status === "ready"
          ? t("ready")
          : error;

  return (
    <div
      id="local-recording-status"
      role={recording.status === "failed" ? "alert" : "status"}
      aria-live={recording.status === "recording" ? "off" : "polite"}
      className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-[#2a2a2e] bg-[#18181b] px-4 py-2 text-center text-sm text-[#d4d4d8]"
    >
      {recording.status === "recording" && (
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[#f87171]" />
      )}
      <span className={recording.status === "failed" ? "text-[#fca5a5]" : undefined}>
        {message}
      </span>
      {recording.status === "recording" && recording.audioTrackCount === 0 && (
        <span className="text-[#fbbf24]">{t("noAudio")}</span>
      )}
      {warning && (
        <span className="text-[#fbbf24]">{warning}</span>
      )}
    </div>
  );
}

/** A short, room-wide disclosure carrying no filename, duration, or media. */
export function RecordingNotice({
  announcement,
  localIdentity,
}: {
  announcement: RecordingAnnouncement | null;
  localIdentity: string;
}) {
  const t = useTranslations("call.recording");
  if (!announcement) return null;

  const mine = announcement.identity === localIdentity;
  const key = announcement.started
    ? mine
      ? "roomStartedYou"
      : "roomStarted"
    : mine
      ? "roomStoppedYou"
      : "roomStopped";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none absolute inset-x-3 top-3 z-20 flex justify-center sm:inset-x-6"
    >
      <p className="rounded-md border border-[#3f3f46] bg-[#18181b]/95 px-3 py-2 text-center text-sm text-[#f4f4f5] shadow-lg">
        {mine
          ? t(key)
          : t.rich(key, {
              name: announcement.name,
              n: (chunks) => <bdi>{chunks}</bdi>,
            })}
      </p>
    </div>
  );
}

function useElapsed(startedAt: number | null): string {
  const format = useFormatter();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const seconds = startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1_000));
  return `${format.number(Math.floor(seconds / 60), { useGrouping: false, minimumIntegerDigits: 2 })}:${format.number(seconds % 60, { useGrouping: false, minimumIntegerDigits: 2 })}`;
}
