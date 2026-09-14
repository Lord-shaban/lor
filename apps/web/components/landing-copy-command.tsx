"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/landing-icons";

export function LandingCopyCommand({
  value,
  copyLabel,
  copiedLabel,
}: {
  value: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // A readable code block remains available when clipboard permissions are
      // unavailable (for example in a private browser context).
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? copiedLabel : copyLabel}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-sm border border-on-foreground/30 px-3 text-sm text-on-foreground transition-colors duration-150 hover:bg-on-foreground/10 active:bg-on-foreground/15"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span>{copied ? copiedLabel : copyLabel}</span>
    </button>
  );
}
