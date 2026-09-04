"use client";

import { useTranslations } from "next-intl";
import type { Announcement } from "@/components/call/use-moderation";

/**
 * What the host just did, said out loud.
 *
 * Shown to everyone, including the person it was done to. A microphone that
 * goes off on its own is indistinguishable from one that broke, and somebody
 * who thinks their equipment failed behaves very differently from somebody who
 * knows they were muted.
 */
export function ModerationNotice({
  announcement,
  onDismiss,
}: {
  announcement: Announcement;
  onDismiss: () => void;
}) {
  const t = useTranslations("call");

  return (
    <div
      // Assertive, not polite: this explains something that has already
      // happened to the listener's own microphone.
      role="status"
      aria-live="assertive"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#2a2a2e] px-4 py-2"
    >
      <span aria-hidden="true" className="shrink-0 text-base leading-none">
        🔇
      </span>

      {/* dir="auto" and <bdi>: the name is in whichever script its owner typed,
          inside a sentence in the interface's. */}
      <p dir="auto" className="min-w-0 flex-1 text-sm text-[#a1a1aa]">
        {t.rich(`moderation.announce.${announcement.action}`, {
          name: announcement.name,
          n: (chunks) => <bdi>{chunks}</bdi>,
        })}
      </p>

      <button
        type="button"
        onClick={onDismiss}
        className="h-9 shrink-0 rounded-md px-3 text-sm text-[#a1a1aa] transition-colors duration-150 hover:bg-[#1e1e21] hover:text-[#f4f4f5]"
      >
        {t("quality.dismiss")}
      </button>
    </div>
  );
}
