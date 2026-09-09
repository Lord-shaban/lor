"use client";

import { useTranslations } from "next-intl";
import type { CarryOverState } from "./use-carry-over";

/** A small, in-flow reminder that does not cover media or steal focus. */
export function CarryOverNotice({
  carryOver,
  onOpenActionItems,
  onRetry,
  onDismiss,
}: {
  carryOver: CarryOverState;
  onOpenActionItems: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("call.carryOver");

  if (carryOver.state === "idle" || (carryOver.state === "ready" && carryOver.count === 0)) {
    return null;
  }

  const failed = carryOver.state === "failed";
  return (
    <section
      className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#2a2a2e] border-s-2 border-s-[#60a5fa] bg-[#141820] px-4 py-2 motion-reduce:transition-none"
      data-testid="carry-over-notice"
    >
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="min-w-0 flex-1 text-sm leading-relaxed text-[#dbeafe]"
      >
        {failed ? t("failed") : t("summary", { count: carryOver.count })}
      </p>

      <div className="flex shrink-0 flex-wrap gap-2">
        {failed ? (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 rounded-md bg-[#1e3a5f] px-3 text-sm font-medium text-[#eff6ff] transition-colors duration-150 hover:bg-[#244a78] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
          >
            {t("retry")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenActionItems}
            className="min-h-11 rounded-md bg-[#eff6ff] px-3 text-sm font-medium text-[#0a0a0b] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
          >
            {t("open")}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-11 rounded-md px-3 text-sm font-medium text-[#bfdbfe] transition-colors duration-150 hover:bg-[#1e3a5f] hover:text-[#eff6ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
        >
          {t("dismiss")}
        </button>
      </div>
    </section>
  );
}
