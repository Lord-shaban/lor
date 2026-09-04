"use client";

import { useTranslations } from "next-intl";
import type { CaptionLog } from "@/lib/stt/caption-log";
import { cn } from "@/lib/cn";

/**
 * The last few lines of what was said, over the video.
 *
 * A strip rather than a panel: captions are read at a glance while somebody is
 * also listening and watching, and a panel would take space from the faces that
 * are the point of the call.
 *
 * Two things here are load-bearing and neither is decoration.
 *
 * **A provisional line looks provisional.** The fast pass is a guess and is
 * often wrong in the exact way this product exists to fix — it transliterates.
 * A reader who cannot tell a guess from the record will quote the guess. So a
 * line that may still change is dimmed and italic, and carries a label a screen
 * reader can announce; it is not colour alone.
 *
 * **The name is isolated, the line is not.** A name next to interface text is
 * the `<bdi>` case; the caption itself is the direction case, and its direction
 * is decided in `caption-log.ts` by counting words. Wrapping the two together
 * is the bidi mistake this repository has made four times, most recently with
 * `سارة (you)` in the chat.
 */
/**
 * How many lines are on screen at once.
 *
 * The log keeps forty — the transcript is built from those. A *strip* is a
 * different thing: it sits over people's faces, and the first version of this
 * showed everything the log held, which covered the call with nine lines of
 * text nobody was reading any more. Three is what is still being said.
 */
const VISIBLE_LINES = 3;

export function CaptionsStrip({ log }: { log: CaptionLog }) {
  const t = useTranslations("call.captions");

  const lines = log.lines.slice(-VISIBLE_LINES);
  if (lines.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-3"
      // Announced as it changes, but politely: a caption interrupting a screen
      // reader mid-sentence is worse than no caption.
      aria-live="polite"
      aria-label={t("region")}
    >
      <div className="w-full max-w-3xl rounded-xl bg-black/70 px-4 py-3 backdrop-blur-sm">
        <ul className="space-y-1.5">
          {lines.map((line) => (
            <li
              key={line.id}
              // The row runs the way the line does, so the name sits against
              // the start of the text it belongs to. Laid out left to right
              // regardless, an Arabic line put the name at the far left and its
              // own first word at the far right, with the width of the strip
              // between them — seen on screen, not reasoned about.
              dir={line.direction}
              className={cn(
                "flex items-baseline gap-2 text-sm leading-relaxed",
                line.state === "provisional" && "opacity-70",
              )}
            >
              <bdi className="shrink-0 text-xs font-medium text-[#a1a1aa]">
                {line.speaker}
              </bdi>
              <p
                className={cn(
                  "min-w-0 flex-1 [overflow-wrap:anywhere]",
                  line.state === "provisional"
                    ? "italic text-[#d4d4d8]"
                    : "text-[#fafafa]",
                )}
              >
                {line.text}
                {line.state === "provisional" && (
                  <span className="sr-only"> {t("stillListening")}</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
