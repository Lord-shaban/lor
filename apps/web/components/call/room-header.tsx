"use client";

import { useEffect, useRef, useState } from "react";
import { useParticipants } from "@livekit/components-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Meeting identity stays in the dock so the stage can use the full height.
 */
export function RoomHeader({
  code,
  inviteUrl,
  inMenu = false,
}: {
  code: string;
  inviteUrl: string;
  inMenu?: boolean;
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
    <div
      data-testid={inMenu ? "room-header-menu" : "room-header"}
      role="group"
      aria-label={t("ariaLabel")}
      aria-describedby={inMenu ? "room-header-menu-code" : "room-header-code"}
      className="flex h-11 min-w-0 items-center gap-1.5 lg:max-w-64"
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="truncate text-xs text-[#a1a1aa]">{t("label")}</span>
          <code
            id={inMenu ? "room-header-menu-code" : "room-header-code"}
            dir="ltr"
            title={code}
            className={inMenu ? "block min-w-0 truncate font-mono text-xs font-medium tracking-[0.06em] text-[#f4f4f5]" : "hidden min-w-0 truncate font-mono text-xs font-medium tracking-[0.06em] text-[#f4f4f5] lg:block"}
          >
            <bdi>{code}</bdi>
          </code>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span role="status" aria-live="polite" aria-atomic="true" aria-label={t("participants", { count: participants.length })} title={t("participants", { count: participants.length })} className="flex min-w-7 items-center justify-center gap-1 text-xs text-[#a1a1aa]">
          <PeopleIcon />
          <bdi>{participants.length}</bdi>
        </span>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          data-testid="copy-invite"
          aria-label={copyLabel}
          title={copyLabel}
          onClick={copyInvite}
          className="h-11 w-11 shrink-0"
        >
          {copyState === "copied" ? <CopiedIcon /> : <LinkIcon />}
        </Button>
      </div>

      <span aria-live="polite" className="sr-only">
        {copyState === "copied"
          ? t("inviteCopied")
          : copyState === "failed"
            ? t("copyInviteFailed")
            : ""}
      </span>
    </div>
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

function CopiedIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="m4 10 4 4 8-8" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="h-4 w-4">
      <circle cx="10" cy="6" r="2.5" />
      <path d="M4.5 16a5.5 5.5 0 0 1 11 0" />
    </svg>
  );
}
