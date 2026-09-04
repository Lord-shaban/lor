"use client";

import { useTranslations } from "next-intl";
import type { WaitingState } from "@/lib/waiting";
import { Button } from "@/components/ui/button";

/**
 * The other side of the door.
 *
 * Everything here is about not lying to somebody who cannot do anything. A
 * spinner says "soon"; if the host has walked away, "soon" is false and the
 * person deserves to know so they can go and do something else. So the two
 * situations get different words, and both offer the way out.
 */
export function WaitingRoom({
  state,
  name,
  onCancel,
}: {
  state: Exclude<WaitingState, "admitted">;
  name: string;
  onCancel: () => void;
}) {
  const t = useTranslations("waiting");

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-border bg-surface p-6"
    >
      <div className="flex items-start gap-4">
        {/* Not a spinner for the refused or abandoned states: motion promises
            that something is still happening. */}
        {state === "waiting" && (
          <span
            aria-hidden="true"
            className="mt-1 h-3 w-3 shrink-0 animate-pulse rounded-full bg-live"
          />
        )}

        <div className="min-w-0">
          <h2 className="text-base font-medium">{t(`${state}.title`)}</h2>

          {/* dir="auto" and <bdi>: the name is whatever they typed, in either
              script, sitting inside a sentence in the other. */}
          <p dir="auto" className="mt-2 text-sm text-muted">
            {t.rich(`${state}.body`, {
              name,
              n: (chunks) => <bdi>{chunks}</bdi>,
            })}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="outline" onClick={onCancel}>
          {state === "denied" ? t("denied.back") : t("cancel")}
        </Button>
      </div>
    </div>
  );
}
