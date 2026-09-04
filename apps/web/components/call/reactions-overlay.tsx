"use client";

import { useTranslations } from "next-intl";
import type { FloatingReaction } from "@/components/call/use-room-messages";

/**
 * Reactions, floating up over the video and getting out of the way.
 *
 * A reaction is a way to answer without interrupting, so it has to be visible
 * and then gone. It never takes a pointer event — an emoji drifting over
 * somebody's face must not be the thing that swallows a click on the tile
 * behind it.
 */
export function ReactionsOverlay({
  reactions,
}: {
  reactions: readonly FloatingReaction[];
}) {
  const t = useTranslations("call");
  const latest = reactions.at(-1);

  return (
    <>
      <div
        // Decorative here; the announcement below carries the meaning.
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      >
        {reactions.map((reaction) => (
          <span
            key={reaction.key}
            className="lor-reaction absolute bottom-2 text-4xl"
            // A logical inset, so the spread mirrors with the layout rather
            // than always starting from the left.
            style={{ insetInlineStart: `${6 + reaction.offset * 82}%` }}
          >
            {reaction.emoji}
          </span>
        ))}
      </div>

      {/* Without this the overlay is silent to a screen reader, and a room
          reacting to what you said reads as a room saying nothing. Only the
          most recent one is announced: politeness queues, and a burst of six
          would be read out long after it left the screen. */}
      <p role="status" aria-live="polite" className="sr-only">
        {latest ? t("reactions.sent", { name: latest.name, emoji: latest.emoji }) : ""}
      </p>
    </>
  );
}
