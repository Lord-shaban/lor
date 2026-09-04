"use client";

import { useTranslations } from "next-intl";
import type { Captions } from "./use-captions";

/**
 * What everybody is told while captions are running.
 *
 * Transcription sends what people say to a third party, and somebody who joined
 * a meeting did not agree to that by joining. So this is not a toast: it stays
 * on screen for as long as captions are on, because a person glancing at the
 * screen at any moment has to be able to tell whether they are being
 * transcribed. The same standard the moderation notices already meet — a
 * microphone that closes on its own is indistinguishable from one that broke.
 *
 * It also carries the only control that makes this consent rather than
 * notification: **stop transcribing me**, which takes this participant's own
 * microphone out without switching captions off for everybody else. Each client
 * transcribes only its own audio, so that switch is complete — nothing of
 * theirs is sent anywhere while it is off.
 */
export function CaptionsNotice({ captions }: { captions: Captions }) {
  const t = useTranslations("call.captions");

  if (!captions.on) return null;

  return (
    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-[#27272a] bg-[#18181b] px-3 py-1.5 text-xs text-[#d4d4d8]">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block size-1.5 shrink-0 rounded-full bg-[#f87171]"
        />
        {captions.sharing ? t("noticeOn") : t("noticeNotYou")}
      </span>

      <button
        type="button"
        onClick={() => captions.setSharing(!captions.sharing)}
        className="rounded-md px-2 py-0.5 font-medium text-[#a1a1aa] underline decoration-[#52525b] underline-offset-2 transition-colors hover:text-[#fafafa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6366f1]"
      >
        {captions.sharing ? t("stopMine") : t("startMine")}
      </button>

      {/* The allowance, before it is gone. Shown only once the server says it
          is worth mentioning — a room warned at eighty per cent can fetch a
          key, and one told at a hundred has already lost its captions
          mid-sentence. */}
      {!captions.error && captions.quota && (
        <span className="text-[#fbbf24]">
          {t("runningLow", { minutes: Math.max(1, Math.round(captions.quota.remaining / 60)) })}
        </span>
      )}

      {captions.error && (
        <span className="text-[#fca5a5]">{t(`error.${captions.error}`)}</span>
      )}
    </div>
  );
}
