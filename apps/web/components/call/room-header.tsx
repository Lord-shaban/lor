"use client";

import { useEffect, useRef, useState } from "react";
import { useParticipants } from "@livekit/components-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * The quiet identity layer for somebody already inside a call.
 *
 * Room metadata is useful, but it should never compete with a reconnecting or
 * recording notice. Keeping it in normal flow at a fixed 48px also means the
 * video stage and the control dock keep their measured space on a phone.
 */
export function RoomHeader({
  code,
  inviteUrl,
}: {
  code: string;
  inviteUrl: string;
}) {
  const t = useTranslations("call.roomHeader");
  const participants = useParticipants();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  async function copyInvite() {
    clearTimeout(resetTimer.current);

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyState("copied");
      resetTimer.current = setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      // A clipboard permission can be denied on an insecure origin. Do not
      // claim success; the invite action remains available to try again.
      setCopyState("failed");
      resetTimer.current = setTimeout(() => setCopyState("idle"), 4000);
    }
  }

  const copyLabel = copyState === "copied" ? t("inviteCopied") : t("copyInvite");

  return (
    <header
      data-testid="room-header"
      aria-label={t("ariaLabel")}
      aria-describedby="room-header-code"
      className="flex h-12 min-h-12 shrink-0 items-center gap-2 border-b border-[#2a2a2e] bg-[#141416] px-3 sm:px-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#2a2a2e] text-[#d4d4d8]"
        >
          <RoomIcon />
        </span>
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="hidden shrink-0 text-xs font-medium text-[#a1a1aa] sm:inline">
            {t("label")}
          </span>
          <code
            id="room-header-code"
            dir="ltr"
            className="min-w-0 truncate font-mono text-xs font-medium tracking-[0.08em] text-[#f4f4f5]"
          >
            <bdi>{code}</bdi>
          </code>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="max-w-[7.5rem] truncate text-xs text-[#a1a1aa]"
        >
          {t("participants", { count: participants.length })}
        </span>

        <Button
          type="button"
          variant="secondary"
          size="md"
          data-testid="copy-invite"
          aria-label={copyLabel}
          onClick={copyInvite}
          className="shrink-0 px-3 sm:px-4"
        >
          <LinkIcon />
          <span>{copyLabel}</span>
        </Button>
      </div>

      <span aria-live="polite" className="sr-only">
        {copyState === "copied"
          ? t("inviteCopied")
          : copyState === "failed"
            ? t("copyInviteFailed")
            : ""}
      </span>
    </header>
  );
}

function RoomIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-4 w-4"
    >
      <path d="M3.25 8.25 10 3l6.75 5.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.25 7.25v8.5h9.5v-8.5M8 15.75v-4.5h4v4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-4 w-4"
    >
      <path d="m8.25 11.75 3.5-3.5" strokeLinecap="round" />
      <path d="M6.2 14.3H5a3.3 3.3 0 0 1 0-6.6h2.1" strokeLinecap="round" />
      <path d="M13.8 5.7H15a3.3 3.3 0 0 1 0 6.6h-2.1" strokeLinecap="round" />
    </svg>
  );
}
