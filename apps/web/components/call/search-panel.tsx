"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { direction as localeDirection, type Locale } from "@/i18n/routing";
import { lineDirection } from "@/lib/bidi";

type SearchKind = "transcript" | "decision" | "notes";

interface SearchResult {
  id: string;
  kind: SearchKind;
  excerpt: string;
  source: {
    transcriptLineId: string | null;
    at: string;
  };
}

interface SearchResponse {
  query: string;
  state: "empty" | "available" | "degraded";
  results: SearchResult[];
  index: {
    state: "empty" | "ready" | "unconfigured" | "degraded";
  };
}

type Failure = "query_invalid" | "rate_limited" | "unavailable";

function failureFrom(response: Response, body: { error?: string } | null): Failure {
  if (response.status === 400 || body?.error === "query_invalid") return "query_invalid";
  if (response.status === 429 || body?.error === "rate_limited") return "rate_limited";
  return "unavailable";
}

function meetingDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

/**
 * A deliberately quiet doorway into retained evidence from ended meetings.
 *
 * It has no load effect: opening the panel does not read, index, or transmit
 * any meeting record. The only request is the explicit, non-empty form submit
 * below, which gives a participant a clear moment to decide to search.
 */
export function SearchPanel({
  code,
  onClose,
  onShowTranscriptSource,
  onShowNotesSource,
}: {
  code: string;
  onClose: () => void;
  onShowTranscriptSource: (id: string) => void;
  onShowNotesSource: () => void;
}) {
  const t = useTranslations("call.search");
  const locale = useLocale() as Locale;
  const fallback = localeDirection[locale];
  const queryRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchResponse | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // A labelled query field is the first useful control. Focusing it also
    // leaves the close control visible, rather than trapping keyboard focus
    // behind the persistent call controls below the panel.
    queryRef.current?.focus();
  }, []);

  async function submit() {
    const normalized = query.replace(/\s+/g, " ").trim();
    if (!normalized || normalized.length > 400) {
      setFailure("query_invalid");
      setSearch(null);
      return;
    }

    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch(`/api/rooms/${code}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalized }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setFailure(failureFrom(response, body));
        return;
      }
      const result = (await response.json()) as SearchResponse;
      setQuery(result.query);
      setSearch(result);
    } catch {
      setFailure("unavailable");
    } finally {
      setBusy(false);
    }
  }

  const providerState = search?.index.state === "unconfigured"
    ? "unconfigured"
    : search?.index.state === "degraded" || search?.state === "degraded"
      ? "degraded"
      : null;

  return (
    <aside
      aria-labelledby="search-title"
      data-testid="search-panel"
      className="absolute inset-y-0 end-0 z-30 flex w-full max-w-md flex-col border-s border-[#27272a] bg-[#111113] lg:static lg:z-auto lg:w-[min(28rem,38vw)] lg:shrink-0"
    >
      <header className="flex items-center justify-between gap-3 border-b border-[#27272a] px-4 py-3">
        <div className="min-w-0">
          <h2 id="search-title" className="text-sm font-semibold text-[#fafafa]">{t("title")}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-[#a1a1aa]">{t("intro")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 shrink-0 rounded-md px-3 text-sm font-medium text-[#d4d4d8] transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
        >
          {t("close")}
        </button>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="border-b border-[#27272a] px-4 py-3"
      >
        <label htmlFor="retained-evidence-query" className="block text-xs font-medium text-[#d4d4d8]">
          {t("field")}
        </label>
        <div className="mt-2 flex items-center gap-2">
          <input
            ref={queryRef}
            id="retained-evidence-query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            dir="auto"
            maxLength={400}
            autoComplete="off"
            aria-describedby="retained-evidence-query-hint retained-evidence-query-error"
            placeholder={t("placeholder")}
            className="min-w-0 flex-1 rounded-md border border-[#52525b] bg-[#18181b] px-3 py-2.5 text-sm text-[#f4f4f5] placeholder:text-[#71717a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5]"
          />
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 shrink-0 rounded-md bg-[#f4f4f5] px-3 text-sm font-medium text-[#0a0a0b] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            {busy ? t("searching") : t("submit")}
          </button>
        </div>
        <p id="retained-evidence-query-hint" className="mt-2 text-xs leading-relaxed text-[#a1a1aa]">
          {t("hint")}
        </p>
        <div id="retained-evidence-query-error" aria-live="polite" aria-atomic="true" className="mt-2">
          {failure === "query_invalid" && (
            <p role="alert" className="text-sm leading-relaxed text-[#fca5a5]">{t(`error.${failure}`)}</p>
          )}
        </div>
      </form>

      <div className="flex-1 overflow-y-auto px-4 py-4" aria-busy={busy}>
        {busy && (
          <div className="space-y-3" aria-label={t("loading")}>
            <div className="h-28 animate-pulse rounded-lg bg-[#1e1e21] motion-reduce:animate-none" />
            <div className="h-28 animate-pulse rounded-lg bg-[#1e1e21] motion-reduce:animate-none" />
          </div>
        )}

        {!busy && failure && failure !== "query_invalid" && (
          <section className="rounded-lg border border-[#7f1d1d] bg-[#1c1012] p-4">
            <p className="text-sm leading-relaxed text-[#fecaca]">{t(`error.${failure}`)}</p>
            <button
              type="button"
              onClick={() => void submit()}
              className="mt-3 min-h-11 rounded-md px-3 text-sm font-medium text-[#f4f4f5] underline decoration-[#a1a1aa] underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
            >
              {t("retry")}
            </button>
          </section>
        )}

        {!busy && !failure && search?.state === "empty" && (
          <EmptyState title={t("emptyTitle")} copy={t("empty")} />
        )}

        {!busy && !failure && search && search.state !== "empty" && (
          <>
            {providerState && (
              <section
                className="mb-4 rounded-lg border border-[#713f12] bg-[#1f170b] p-3"
                aria-live="polite"
              >
                <h3 className="text-sm font-medium text-[#fde68a]">{t(`${providerState}Title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#fef3c7]">{t(providerState)}</p>
              </section>
            )}

            {search.results.length === 0 ? (
              <EmptyState title={t("noResultsTitle")} copy={t("noResults")} />
            ) : (
              <ol className="space-y-3" aria-label={t("results")}>
                {search.results.map((result) => (
                  <li key={result.id}>
                    <article className="rounded-lg border border-[#3f3f46] bg-[#18181b] p-3">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#a1a1aa]">
                        <span className="rounded-full bg-[#27272a] px-2 py-0.5 text-[#e4e4e7]">{t(`kind.${result.kind}`)}</span>
                        <time dateTime={result.source.at}>
                          {t("meetingDate", { date: meetingDate(result.source.at, locale) })}
                        </time>
                      </p>
                      <blockquote
                        dir={lineDirection(result.excerpt, fallback)}
                        className="mt-3 border-s-2 border-[#52525b] ps-3 text-sm leading-relaxed text-[#f4f4f5]"
                      >
                        {result.excerpt}
                      </blockquote>
                      {result.kind === "notes" ? (
                        <button
                          type="button"
                          onClick={onShowNotesSource}
                          className="mt-3 min-h-11 rounded-md px-2 text-sm font-medium text-[#d4d4d8] underline decoration-[#71717a] underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
                        >
                          {t("openNotes")}
                        </button>
                      ) : result.source.transcriptLineId ? (
                        <button
                          type="button"
                          onClick={() => onShowTranscriptSource(result.source.transcriptLineId!)}
                          className="mt-3 min-h-11 rounded-md px-2 text-sm font-medium text-[#d4d4d8] underline decoration-[#71717a] underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
                        >
                          {t("openCaption")}
                        </button>
                      ) : null}
                    </article>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <section className="rounded-lg border border-[#3f3f46] bg-[#18181b] p-4">
      <h3 className="text-sm font-medium text-[#f4f4f5]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">{copy}</p>
    </section>
  );
}
