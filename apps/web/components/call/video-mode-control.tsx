"use client";

import { useTranslations } from "next-intl";
import { VIDEO_MODES, type VideoMode } from "@/lib/video-mode";
import { cn } from "@/lib/cn";

/**
 * How much video to spend bandwidth on.
 *
 * In the bar rather than behind a settings menu, and on by default rather than
 * offered after something has already gone wrong. Somebody whose call is
 * breaking up is not in a position to go looking for the fix, and on mobile
 * data they often know before the connection indicator does.
 *
 * A radio group, not three toggles: the three states are exclusive, and a
 * screen reader should say "audio only, 3 of 3" rather than reading three
 * unrelated buttons.
 */
export function VideoModeControl({
  mode,
  onChoose,
}: {
  mode: VideoMode;
  onChoose: (mode: VideoMode) => void;
}) {
  const t = useTranslations("call");

  return (
    <div
      role="radiogroup"
      aria-label={t("video.label")}
      className="flex h-11 overflow-hidden rounded-md bg-[#1e1e21]"
    >
      {VIDEO_MODES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={mode === option}
          onClick={() => onChoose(option)}
          className={cn(
            // Full height, so each segment is a 44px target rather than a
            // strip inside one.
            "h-11 px-3 text-sm font-medium transition-colors duration-150",
            mode === option
              ? "bg-[#f4f4f5] text-[#0a0a0b]"
              : "text-[#a1a1aa] hover:bg-[#2a2a2e] hover:text-[#f4f4f5]",
          )}
        >
          {t(`video.${option}`)}
        </button>
      ))}
    </div>
  );
}
