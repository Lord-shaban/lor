"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { direction as localeDirection, type Locale } from "@/i18n/routing";
import { lineDirection } from "@/lib/bidi";
import { cn } from "@/lib/cn";

/**
 * What the meeting produced, after it has stopped producing it.
 *
 * The line this panel sits on is the product's whole premise — video meetings
 * that *remember*. So three things here are not negotiable.
 *
 * **The summary is labelled as generated and the transcript is one press
 * away.** A summary nobody can check is a rumour, and this one is built by a
 * model that will occasionally be confidently wrong about who agreed to what.
 *
 * **Deleting is offered next to the thing being kept**, not hidden in a
 * settings screen somebody would have to know exists. It takes the summary
 * with it, because a summary is a copy of exactly what was deleted.
 *
 * **The retention period is stated here**, in the interface, and not only in
 * `SECURITY.md`. A promise made in a policy file is a promise made to nobody in
 * the room.
 */

interface Line {
  speaker: string;
  text: string;
  seq: number;
}

interface Stored {
  lines: Line[];
  summary: { text: string; fromLines: number; stale: boolean } | null;
  retentionDays: number;
}

export function TranscriptPanel({
  code,
  onClose,
}: {
  code: string;
  onClose: () => void;
}) {
  const t = useTranslations("call.transcript");
  const locale = useLocale() as Locale;
  const fallback = localeDirection[locale];

  const [stored, setStored] = useState<Stored | null>(null);
  const [busy, setBusy] = useState<"summary" | "delete" | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch(`/api/rooms/${code}/transcript`);
    if (!response.ok) return setStored({ lines: [], summary: null, retentionDays: 30 });
    setStored((await response.json()) as Stored);
  }, [code]);

  useEffect(() => {
    // Scheduled rather than called. State set synchronously in an effect body
    // cascades another render before the first paint, and this repository has
    // been told so by lint twice already — the panel opens, then fills.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function makeSummary() {
    setBusy("summary");
    setFailed(null);
    try {
      const response = await fetch(`/api/rooms/${code}/summary`, { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setFailed(body?.error ?? "unavailable");
      } else {
        await load();
        setShowSummary(true);
      }
    } catch {
      setFailed("unavailable");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      await fetch(`/api/rooms/${code}/transcript`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  const lines = stored?.lines ?? [];

  return (
    <aside
      className="absolute inset-y-0 z-30 flex w-full max-w-md flex-col border-s border-[#27272a] bg-[#111113] end-0"
      aria-label={t("title")}
    >
      <header className="flex items-baseline justify-between gap-2 border-b border-[#27272a] px-4 py-3">
        <h2 className="text-sm font-semibold text-[#fafafa]">{t("title")}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs text-[#a1a1aa] hover:text-[#fafafa]"
        >
          {t("close")}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {stored === null && <p className="text-xs text-[#71717a]">{t("loading")}</p>}

        {stored !== null && lines.length === 0 && (
          <p className="text-xs leading-relaxed text-[#71717a]">{t("empty")}</p>
        )}

        {stored?.summary && showSummary && (
          <section className="mb-4 rounded-lg border border-[#27272a] bg-[#18181b] p-3">
            <h3 className="flex flex-wrap items-baseline gap-x-2 text-xs font-medium text-[#a1a1aa]">
              {t("summary")}
              {/* Labelled, always. A summary nobody can check is a rumour. */}
              <span className="text-[10px] font-normal text-[#71717a]">
                {t("generated")}
              </span>
            </h3>
            <p
              dir={lineDirection(stored.summary.text, fallback)}
              className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#f4f4f5]"
            >
              {stored.summary.text}
            </p>
            {stored.summary.stale && (
              <p className="mt-2 text-[11px] text-[#fbbf24]">{t("stale")}</p>
            )}
            <button
              type="button"
              onClick={() => setShowSummary(false)}
              className="mt-2 text-[11px] text-[#a1a1aa] underline decoration-[#52525b] underline-offset-2 hover:text-[#fafafa]"
            >
              {t("showTranscript")}
            </button>
          </section>
        )}

        <ul className="flex flex-col gap-2">
          {lines.map((line) => (
            <li key={line.seq} className="text-sm leading-relaxed">
              <bdi className="me-2 text-xs font-medium text-[#a1a1aa]">{line.speaker}</bdi>
              <span dir={lineDirection(line.text, fallback)} className="text-[#f4f4f5]">
                {line.text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <footer className="flex flex-col gap-2 border-t border-[#27272a] px-4 py-3">
        {failed && <p className="text-xs text-[#fca5a5]">{t(`error.${failed}`)}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={makeSummary}
            disabled={lines.length === 0 || busy !== null}
            className="rounded-md bg-[#f4f4f5] px-3 py-1.5 text-sm font-medium text-[#0a0a0b] disabled:opacity-40"
          >
            {busy === "summary" ? t("summarising") : t("summarise")}
          </button>

          {/* Next to the thing being kept, not hidden somewhere a person would
              have to already know about. */}
          <button
            type="button"
            onClick={remove}
            disabled={lines.length === 0 || busy !== null}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm text-[#a1a1aa] hover:text-[#fca5a5]",
              "disabled:opacity-40 disabled:hover:text-[#a1a1aa]",
            )}
          >
            {t("delete")}
          </button>
        </div>

        {/* Stated in the room, not only in a policy file nobody in the meeting
            is going to open. */}
        <p className="text-[11px] leading-relaxed text-[#71717a]">
          {t("retention", { days: stored?.retentionDays ?? 30 })}
        </p>
      </footer>
    </aside>
  );
}
