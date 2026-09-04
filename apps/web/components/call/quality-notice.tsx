"use client";

import { useTranslations } from "next-intl";

/**
 * Say that the call gave up video, and why.
 *
 * Quality that drops silently reads as the product being bad; a person who gets
 * quieter and blurrier without explanation reads as them being rude. Neither is
 * what happened, and both are avoided by one sentence.
 *
 * It offers the way back rather than only the news. Someone who knows their
 * connection is fine — a lift, a tunnel, thirty seconds of a bad cell — should
 * not have to work out which control undid this.
 */
export function QualityNotice({
  onRestore,
  onDismiss,
}: {
  onRestore: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("call");

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#2a2a2e] px-4 py-2"
    >
      <span aria-hidden="true" className="shrink-0 text-base leading-none">
        📶
      </span>

      {/* dir="auto" and min-w-0: the sentence is long in both languages and must
          wrap rather than push the buttons off a phone. */}
      <p dir="auto" className="min-w-0 flex-1 text-sm text-[#a1a1aa]">
        {t("quality.reduced")}
      </p>

      <button
        type="button"
        onClick={onRestore}
        className="h-9 shrink-0 rounded-md bg-[#1e1e21] px-3 text-sm font-medium text-[#f4f4f5] transition-colors duration-150 hover:bg-[#2a2a2e]"
      >
        {t("quality.restore")}
      </button>

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
