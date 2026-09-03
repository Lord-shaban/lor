"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Copy the invitation link, and say so.
 *
 * The confirmation is the point: without it people click twice, unsure whether
 * anything happened.
 */
export function CopyLink({ url }: { url: string }) {
  const t = useTranslations("room");
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeout.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Denied permission, or an insecure origin. The link is on screen and
      // selectable, so this is a missing convenience rather than a dead end —
      // claiming success would be worse than staying quiet.
      return;
    }

    setCopied(true);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* The link is Latin whatever the interface language, and selectable so
          it can be copied by hand if the clipboard is unavailable. */}
      <code
        dir="ltr"
        className="min-w-0 flex-1 truncate rounded-sm border border-border bg-surface-strong px-3 py-2 font-mono text-sm"
      >
        {url}
      </code>

      <Button variant="secondary" onClick={copy}>
        {copied ? t("copied") : t("copy")}
      </Button>

      {/* Polite rather than assertive: it confirms something minor and should
          not interrupt whatever is being read. */}
      <span aria-live="polite" className="sr-only">
        {copied ? t("copied") : ""}
      </span>
    </div>
  );
}
