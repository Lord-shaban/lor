"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { direction as localeDirection, type Locale } from "@/i18n/routing";
import { lineDirection } from "@/lib/bidi";

interface SourceLine {
  seq: number;
  speaker: string;
  quote: string;
  at: string;
}

interface MemoryAvailable {
  state: "available";
  retentionDays: number;
  lastOccurrence: { id: string; startedAt: string; endedAt: string };
  decisions: { id: string; text: string; confirmedAt: string; source: SourceLine }[];
  actionItems: {
    id: string;
    text: string;
    assigneeName: string | null;
    dueOn: string | null;
    openedAt: string;
    source: SourceLine;
  }[];
  glossary: string[];
  repeatedSpeakers: { name: string; occurrenceCount: number; lastSpokeAt: string; kind: "repeated" }[];
}

interface MemoryEmpty {
  state: "empty";
  reason: "no_retained_history";
  retentionDays: number;
  lastOccurrence: null;
  decisions: [];
  actionItems: [];
  glossary: [];
  repeatedSpeakers: [];
}

type MeetingMemory = MemoryAvailable | MemoryEmpty;

function dateTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function dateOnly(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00Z`));
}

/**
 * An on-demand doorway to the prior, ended occurrences of this room. Its
 * contents are factual links into retained captions; it never invents a
 * meeting summary or turns display names into an attendance record.
 */
export function MemoryPanel({
  code,
  onClose,
  onShowSource,
}: {
  code: string;
  onClose: () => void;
  onShowSource: (seq: number) => void;
}) {
  const t = useTranslations("call.memory");
  const locale = useLocale() as Locale;
  const fallback = localeDirection[locale];
  const [memory, setMemory] = useState<MeetingMemory | null>(null);
  const [failed, setFailed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms/${code}/memory`);
      if (!response.ok) throw new Error("unavailable");
      setMemory((await response.json()) as MeetingMemory);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [code]);

  useEffect(() => {
    // Paint the stable panel before its deliberately on-demand request starts.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const available = memory?.state === "available" ? memory : null;

  return (
    <aside
      data-testid="memory-panel"
      aria-label={t("title")}
      className="absolute inset-y-0 end-0 z-30 flex w-full max-w-md flex-col border-s border-[#27272a] bg-[#111113]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-[#27272a] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#fafafa]">{t("title")}</h2>
          <p className="mt-0.5 text-xs text-[#a1a1aa]">{t("intro")}</p>
        </div>
        <button
          type="button"
          ref={closeButtonRef}
          onClick={onClose}
          className="min-h-11 shrink-0 rounded-md px-3 text-sm font-medium text-[#d4d4d8] transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
        >
          {t("close")}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4" aria-busy={memory === null && !failed}>
        {memory === null && !failed && (
          <div className="space-y-3" aria-label={t("loading")}>
            <div className="h-20 animate-pulse rounded-lg bg-[#1e1e21] motion-reduce:animate-none" />
            <div className="h-28 animate-pulse rounded-lg bg-[#1e1e21] motion-reduce:animate-none" />
          </div>
        )}

        {memory === null && failed && (
          <FailureState onRetry={() => void load()} t={t} />
        )}

        {memory?.state === "empty" && (
          <section className="rounded-lg border border-[#3f3f46] bg-[#18181b] p-4">
            <h3 className="text-sm font-medium text-[#f4f4f5]">{t("emptyTitle")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">{t("empty")}</p>
            <p className="mt-3 text-xs leading-relaxed text-[#a1a1aa]">
              {t("retention", { days: memory.retentionDays })}
            </p>
          </section>
        )}

        {available && (
          <>
            <section className="mb-5 rounded-lg border border-[#3f3f46] bg-[#18181b] p-3">
              <h3 className="text-sm font-medium text-[#f4f4f5]">{t("lastMeeting")}</h3>
              <time dateTime={available.lastOccurrence.endedAt} className="mt-1 block text-sm text-[#d4d4d8]">
                {t("endedAt", { time: dateTime(available.lastOccurrence.endedAt, locale) })}
              </time>
              <p className="mt-2 text-xs leading-relaxed text-[#a1a1aa]">
                {t("retention", { days: available.retentionDays })}
              </p>
            </section>

            <MemorySection title={t("decisions")} empty={t("decisionsEmpty")} hasItems={available.decisions.length > 0}>
              {available.decisions.map((decision) => (
                <SourceFact
                  key={decision.id}
                  id={decision.id}
                  text={decision.text}
                  source={decision.source}
                  fallback={fallback}
                  showSource={t("showSource")}
                  onShowSource={onShowSource}
                />
              ))}
            </MemorySection>

            <MemorySection title={t("actionItems")} empty={t("actionItemsEmpty")} hasItems={available.actionItems.length > 0}>
              {available.actionItems.map((item) => (
                <article key={item.id} data-memory-action-id={item.id} className="rounded-lg border border-[#3f3f46] bg-[#18181b] p-3">
                  <p dir={lineDirection(item.text, fallback)} className="wrap-anywhere text-sm leading-relaxed text-[#f4f4f5]">{item.text}</p>
                  {(item.assigneeName || item.dueOn) && (
                    <p className="mt-2 text-xs text-[#d4d4d8]">
                      {item.assigneeName && <><span>{t("assignee")}</span> <bdi>{item.assigneeName}</bdi></>}
                      {item.assigneeName && item.dueOn && <span aria-hidden="true"> · </span>}
                      {item.dueOn && <><span>{t("dueOn")}</span> <bdi>{dateOnly(item.dueOn, locale)}</bdi></>}
                    </p>
                  )}
                  <Evidence source={item.source} fallback={fallback} />
                  <SourceButton label={t("showSource")} seq={item.source.seq} onShowSource={onShowSource} />
                </article>
              ))}
            </MemorySection>

            <MemorySection title={t("vocabulary")} empty={t("vocabularyEmpty")} hasItems={available.glossary.length > 0}>
              <ul className="flex flex-wrap gap-2">
                {available.glossary.map((term) => (
                  <li key={term} className="rounded-full bg-[#27272a] px-3 py-1 text-sm text-[#e4e4e7]"><bdi>{term}</bdi></li>
                ))}
              </ul>
            </MemorySection>

            <MemorySection title={t("repeatedSpeakers")} empty={t("repeatedSpeakersEmpty")} hasItems={available.repeatedSpeakers.length > 0}>
              <ul className="space-y-2">
                {available.repeatedSpeakers.map((speaker) => (
                  <li key={speaker.name} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-[#3f3f46] bg-[#18181b] px-3 py-2">
                    <bdi className="min-w-0 wrap-anywhere text-sm font-medium text-[#f4f4f5]">{speaker.name}</bdi>
                    <span className="text-xs text-[#a1a1aa]">{t("repeatedSpeakerCount", { count: speaker.occurrenceCount })}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-[#a1a1aa]">{t("repeatedSpeakersHint")}</p>
            </MemorySection>
          </>
        )}
      </div>
    </aside>
  );
}

function MemorySection({
  title,
  empty,
  hasItems,
  children,
}: {
  title: string;
  empty: string;
  hasItems: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6" aria-label={title}>
      <h3 className="mb-3 text-sm font-medium text-[#f4f4f5]">{title}</h3>
      {hasItems ? children : <p className="text-sm leading-relaxed text-[#a1a1aa]">{empty}</p>}
    </section>
  );
}

function SourceFact({
  id,
  text,
  source,
  fallback,
  showSource,
  onShowSource,
}: {
  id: string;
  text: string;
  source: SourceLine;
  fallback: "rtl" | "ltr";
  showSource: string;
  onShowSource: (seq: number) => void;
}) {
  return (
    <article data-memory-decision-id={id} className="rounded-lg border border-[#3f3f46] bg-[#18181b] p-3">
      <p dir={lineDirection(text, fallback)} className="wrap-anywhere text-sm leading-relaxed text-[#f4f4f5]">{text}</p>
      <Evidence source={source} fallback={fallback} />
      <SourceButton label={showSource} seq={source.seq} onShowSource={onShowSource} />
    </article>
  );
}

function Evidence({ source, fallback }: { source: SourceLine; fallback: "rtl" | "ltr" }) {
  return (
    <div className="mt-3 border-s border-[#52525b] ps-3 text-xs leading-relaxed text-[#a1a1aa]">
      <bdi className="font-medium text-[#d4d4d8]">{source.speaker}</bdi>
      <p dir={lineDirection(source.quote, fallback)} className="mt-1 wrap-anywhere">{source.quote}</p>
    </div>
  );
}

function SourceButton({ label, seq, onShowSource }: { label: string; seq: number; onShowSource: (seq: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onShowSource(seq)}
      className="mt-2 min-h-11 rounded-md px-2 text-sm font-medium text-[#d4d4d8] underline decoration-[#71717a] underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
    >
      {label}
    </button>
  );
}

function FailureState({ onRetry, t }: { onRetry: () => void; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="rounded-lg border border-[#7f1d1d] bg-[#1c1012] p-3">
      <p role="alert" className="text-sm leading-relaxed text-[#fecaca]">{t("error.unavailable")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 min-h-11 rounded-md px-3 text-sm font-medium text-[#f4f4f5] underline decoration-[#f87171] underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
      >
        {t("retry")}
      </button>
    </div>
  );
}
