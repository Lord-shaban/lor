"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { RaisedHand } from "@/lib/hand-queue";

/**
 * Who is waiting to speak, oldest first.
 *
 * A row of raised hands would say who wants a turn; a numbered queue says who
 * has been waiting longest, and that is the version a host can act on fairly.
 * It only exists while somebody has a hand up — a permanently empty strip is a
 * permanent tax on the height of the video.
 */
export function HandQueue({
  hands,
  localIdentity,
}: {
  hands: readonly RaisedHand[];
  localIdentity: string;
}) {
  const t = useTranslations("call");
  const format = useFormatter();

  if (hands.length === 0) return null;

  return (
    <div
      // Announced politely: a host watching the grid should not have to also
      // watch this strip to know a hand went up.
      role="status"
      aria-live="polite"
      className="flex shrink-0 items-center gap-3 overflow-x-auto border-t border-[#2a2a2e] px-4 py-2"
    >
      <span aria-hidden="true" className="shrink-0 text-base leading-none">
        ✋
      </span>
      <span className="shrink-0 text-sm text-[#a1a1aa]">
        {t("hands.waiting", { count: hands.length })}
      </span>

      <ol className="flex items-center gap-2">
        {hands.map((hand, index) => (
          <li
            key={hand.identity}
            className="flex shrink-0 items-center gap-2 rounded-full bg-[#1e1e21] px-3 py-1 text-sm text-[#f4f4f5]"
          >
            {/* Localised digits, isolated so they do not reorder against a
                name in the other script. */}
            <bdi className="text-[#a1a1aa] tabular-nums">
              {format.number(index + 1)}
            </bdi>

            {/* Only the name is isolated — never the name together with the
                "(you)", or the whole run takes the name's direction. */}
            <span className="max-w-40 truncate">
              {hand.identity === localIdentity ? (
                t.rich("youLabel", {
                  name: hand.name,
                  n: (chunks) => <bdi>{chunks}</bdi>,
                })
              ) : (
                <bdi>{hand.name}</bdi>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
