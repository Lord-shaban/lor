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
export function CaptionsNotice({
  captions,
  onOpenKeys,
}: {
  captions: Captions;
  onOpenKeys: () => void;
}) {
  const t = useTranslations("call.captions");
  const keys = useTranslations("call.keys");
  const keeping = useTranslations("call.keeping");

  if (!captions.on) return null;

  return (
    <div
      data-testid="captions-notice"
      className="pointer-events-auto flex min-h-[3.25rem] items-center gap-2 overflow-x-auto border-t border-[#27272a] bg-[#18181b] px-3 py-1 text-xs text-[#d4d4d8]"
    >
      <span className="flex min-w-32 flex-1 items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block size-1.5 shrink-0 rounded-full bg-[#f87171]"
        />
        <span className="sm:hidden">
          {captions.sharing ? t("noticeShortOn") : t("noticeShortNotYou")}
        </span>
        <span className="hidden sm:inline">
          {captions.sharing ? t("noticeOn") : t("noticeNotYou")}
        </span>
      </span>

      {/* A second sentence, not a longer first one. Agreeing that words appear
          on a screen is not agreeing that they are written down, so the record
          announces itself separately or it has not been announced. */}
      {captions.keeping && (
        <span className="hidden shrink-0 text-[#fbbf24] lg:inline">
          {keeping("notice")}
        </span>
      )}

      <button
        type="button"
        onClick={captions.toggleKeeping}
        aria-label={captions.keeping ? keeping("off") : keeping("on")}
        title={captions.keeping ? keeping("off") : keeping("on")}
        className="min-h-11 shrink-0 rounded-md px-2 py-0.5 font-medium text-[#d4d4d8] underline decoration-[#52525b] underline-offset-2 transition-colors hover:text-[#fafafa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5]"
      >
        {captions.keeping ? keeping("offShort") : keeping("onShort")}
      </button>

      <button
        type="button"
        onClick={() => captions.setSharing(!captions.sharing)}
        aria-label={captions.sharing ? t("stopMine") : t("startMine")}
        title={captions.sharing ? t("stopMine") : t("startMine")}
        className="min-h-11 shrink-0 rounded-md px-2 py-0.5 font-medium text-[#d4d4d8] underline decoration-[#52525b] underline-offset-2 transition-colors hover:text-[#fafafa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5]"
      >
        {captions.sharing ? t("stopMineShort") : t("startMineShort")}
      </button>

      {/* The allowance, before it is gone. Shown only once the server says it
          is worth mentioning — a room warned at eighty per cent can fetch a
          key, and one told at a hundred has already lost its captions
          mid-sentence. */}
      {!captions.error && captions.quota && (
        <span className="min-w-48 shrink-0 text-[#fbbf24]">
          {t("runningLow", { minutes: Math.max(1, Math.round(captions.quota.remaining / 60)) })}
        </span>
      )}

      {captions.error && (
        <span className="min-w-48 shrink-0 text-[#fca5a5]">
          {t(`error.${captions.error}`)}
        </span>
      )}

      {/* The way past the wall, next to the wall. A message telling somebody to
          add a key, with nowhere to add one, is not a hand-off. */}
      {(captions.error === "quota" || captions.error === "no_key" || captions.quota) && (
        <button
          type="button"
          onClick={onOpenKeys}
          className="min-h-11 shrink-0 rounded-md px-2 py-0.5 font-medium text-[#fafafa] underline decoration-[#52525b] underline-offset-2 transition-colors hover:decoration-[#fafafa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5]"
        >
          {keys("open")}
        </button>
      )}
    </div>
  );
}
