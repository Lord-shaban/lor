"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { direction as localeDirection, type Locale } from "@/i18n/routing";
import { lineDirection } from "@/lib/bidi";
import { cn } from "@/lib/cn";

interface Decision {
  id: string;
  status: "proposed" | "confirmed";
  origin: "manual" | "llm";
  text: string;
  source: {
    seq: number;
    speaker: string;
    quote: string;
    at: string;
  };
}

interface StoredDecisions {
  canReview: boolean;
  retentionDays: number;
  decisions: Decision[];
}

type Failure =
  | "no_key"
  | "quota"
  | "transcript_too_short"
  | "nothing_to_extract"
  | "unavailable"
  | "host_lost"
  | "decision_unavailable"
  | "decision_text_invalid";

function failureFrom(response: Response, body: { error?: string } | null): Failure {
  if (response.status === 404) return "decision_unavailable";
  switch (body?.error) {
    case "no_key":
    case "quota":
    case "transcript_too_short":
    case "nothing_to_extract":
    case "decision_text_invalid":
      return body.error;
    default:
      return "unavailable";
  }
}

/**
 * A review queue, not a second transcript and not a place for a model to make
 * a meeting fact. Every card keeps its server-derived evidence in view before
 * the host can alter or confirm the concise decision wording.
 */
export function DecisionPanel({
  code,
  onClose,
  onShowSource,
}: {
  code: string;
  onClose: () => void;
  onShowSource: (seq: number) => void;
}) {
  const t = useTranslations("call.decisions");
  const locale = useLocale() as Locale;
  const fallback = localeDirection[locale];
  const [stored, setStored] = useState<StoredDecisions | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms/${code}/decisions`);
      if (!response.ok) throw new Error("Could not load decisions");
      const latest = (await response.json()) as StoredDecisions;
      setStored(latest);
      setLoadFailed(false);
      return latest;
    } catch {
      setLoadFailed(true);
      return false;
    }
  }, [code]);

  useEffect(() => {
    // Keep the first paint cheap. This is a live-call overlay, so its loading
    // state must be explicit instead of briefly pretending there are no data.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const proposals = useMemo(
    () => stored?.decisions.filter((decision) => decision.status === "proposed") ?? [],
    [stored],
  );
  const confirmed = useMemo(
    () => stored?.decisions.filter((decision) => decision.status === "confirmed") ?? [],
    [stored],
  );

  function isBusy(action: string, id?: string) {
    return busy === `${action}:${id ?? "room"}`;
  }

  async function mutate({
    action,
    id,
    path = `/api/rooms/${code}/decisions`,
    init,
    success,
  }: {
    action: "extract" | "confirm" | "edit" | "delete";
    id?: string;
    path?: string;
    init: RequestInit;
    success: string;
  }) {
    setBusy(`${action}:${id ?? "room"}`);
    setFailure(null);
    setNotice(null);
    try {
      const response = await fetch(path, init);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        // This also checks whether a mid-call host handover has removed the
        // controls. No optimistic success survives a server refusal.
        const latest = await load();
        setFailure(
          response.status === 404 && latest && !latest.canReview
            ? "host_lost"
            : failureFrom(response, body),
        );
        return false;
      }
      if (!await load()) {
        setFailure("unavailable");
        return false;
      }
      setNotice(success);
      return true;
    } catch {
      setFailure("unavailable");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function extract() {
    const succeeded = await mutate({
      action: "extract",
      path: `/api/rooms/${code}/decisions/extract`,
      init: { method: "POST" },
      success: t("extracted"),
    });
    if (succeeded) {
      setEditingId(null);
      setDeleteConfirmation(null);
    }
  }

  async function confirm(decision: Decision) {
    await mutate({
      action: "confirm",
      id: decision.id,
      init: {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: decision.id, action: "confirm" }),
      },
      success: t("confirmed"),
    });
  }

  async function saveEdit(decision: Decision) {
    const text = draft.trim();
    if (!text) {
      setFailure("decision_text_invalid");
      return;
    }
    const succeeded = await mutate({
      action: "edit",
      id: decision.id,
      init: {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: decision.id, action: "edit", text }),
      },
      success: t("edited"),
    });
    if (succeeded) setEditingId(null);
  }

  async function remove(decision: Decision) {
    const succeeded = await mutate({
      action: "delete",
      id: decision.id,
      init: {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: decision.id }),
      },
      success: t("deleted"),
    });
    if (succeeded) setDeleteConfirmation(null);
  }

  return (
    <aside
      className="absolute end-0 inset-y-0 z-30 flex w-full max-w-md flex-col border-s border-[#27272a] bg-[#111113]"
      aria-label={t("title")}
      data-testid="decision-panel"
    >
      <header className="flex items-center justify-between gap-3 border-b border-[#27272a] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#fafafa]">{t("title")}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-[#a1a1aa]">{t("intro")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-11 shrink-0 rounded-md px-3 text-sm font-medium text-[#a1a1aa] transition-colors duration-150 hover:text-[#fafafa] motion-reduce:transition-none"
        >
          {t("close")}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4" aria-busy={busy !== null}>
        <div aria-live="polite" aria-atomic="true" className="mb-3">
          {notice && <p className="text-sm text-[#bbf7d0]">{notice}</p>}
          {failure && <p role="alert" className="text-sm leading-relaxed text-[#fca5a5]">{t(`error.${failure}`)}</p>}
        </div>

        {stored === null && !loadFailed && (
          <p className="text-sm text-[#a1a1aa]">{t("loading")}</p>
        )}

        {stored === null && loadFailed && (
          <div className="rounded-lg border border-[#7f1d1d] bg-[#1c1012] p-3">
            <p className="text-sm leading-relaxed text-[#fecaca]">{t("error.unavailable")}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-2 min-h-11 rounded-md px-3 text-sm font-medium text-[#f4f4f5] underline decoration-[#f87171] underline-offset-4 transition-colors duration-150 hover:text-white motion-reduce:transition-none"
            >
              {t("retry")}
            </button>
          </div>
        )}

        {stored && (
          <>
            {stored.canReview && (
              <section className="mb-5 rounded-lg border border-[#3f3f46] bg-[#18181b] p-3">
                <h3 className="text-sm font-medium text-[#f4f4f5]">{t("extractTitle")}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#a1a1aa]">{t("extractHint")}</p>
                <button
                  type="button"
                  onClick={() => void extract()}
                  disabled={busy !== null}
                  className="mt-3 min-h-11 rounded-md bg-[#f4f4f5] px-4 text-sm font-medium text-[#0a0a0b] transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                >
                  {isBusy("extract") ? t("extracting") : t("extract")}
                </button>
              </section>
            )}

            {stored.canReview && proposals.length > 0 && (
              <DecisionSection title={t("proposals")}>
                {proposals.map((decision) => (
                  <DecisionCard
                    key={decision.id}
                    decision={decision}
                    canReview={stored.canReview}
                    editing={editingId === decision.id}
                    draft={draft}
                    deleting={deleteConfirmation === decision.id}
                    busy={busy !== null}
                    fallback={fallback}
                    locale={locale}
                    t={t}
                    onShowSource={onShowSource}
                    onStartEdit={() => {
                      setEditingId(decision.id);
                      setDraft(decision.text);
                      setDeleteConfirmation(null);
                    }}
                    onDraftChange={setDraft}
                    onCancelEdit={() => setEditingId(null)}
                    onSaveEdit={() => void saveEdit(decision)}
                    onConfirm={() => void confirm(decision)}
                    onAskDelete={() => {
                      setDeleteConfirmation(decision.id);
                      setEditingId(null);
                    }}
                    onCancelDelete={() => setDeleteConfirmation(null)}
                    onDelete={() => void remove(decision)}
                  />
                ))}
              </DecisionSection>
            )}

            {confirmed.length > 0 && (
              <DecisionSection title={t("confirmedTitle")}>
                {confirmed.map((decision) => (
                  <DecisionCard
                    key={decision.id}
                    decision={decision}
                    canReview={stored.canReview}
                    editing={false}
                    draft=""
                    deleting={deleteConfirmation === decision.id}
                    busy={busy !== null}
                    fallback={fallback}
                    locale={locale}
                    t={t}
                    onShowSource={onShowSource}
                    onStartEdit={() => undefined}
                    onDraftChange={() => undefined}
                    onCancelEdit={() => undefined}
                    onSaveEdit={() => undefined}
                    onConfirm={() => undefined}
                    onAskDelete={() => setDeleteConfirmation(decision.id)}
                    onCancelDelete={() => setDeleteConfirmation(null)}
                    onDelete={() => void remove(decision)}
                  />
                ))}
              </DecisionSection>
            )}

            {stored.decisions.length === 0 && (
              <p className="max-w-sm text-sm leading-relaxed text-[#a1a1aa]">
                {stored.canReview ? t("emptyHost") : t("emptyGuest")}
              </p>
            )}
          </>
        )}
      </div>

      <footer className="border-t border-[#27272a] px-4 py-3">
        {stored && (
          <div className="mb-3">
            {confirmed.length > 0 ? (
              <a
                href={`/api/rooms/${code}/decisions/export`}
                download
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-[#d4d4d8] underline decoration-[#52525b] underline-offset-4 transition-colors duration-150 hover:text-[#fafafa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
              >
                {t("export")}
              </a>
            ) : (
              <div>
                <button
                  type="button"
                  disabled
                  aria-describedby="decision-export-unavailable"
                  className="min-h-11 rounded-md px-3 text-sm font-medium text-[#71717a] disabled:cursor-not-allowed"
                >
                  {t("export")}
                </button>
                <p id="decision-export-unavailable" className="mt-1 text-xs leading-relaxed text-[#71717a]">
                  {t("exportUnavailable")}
                </p>
              </div>
            )}
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-[#71717a]">
          {t("retention", { days: stored?.retentionDays ?? 30 })}
        </p>
      </footer>
    </aside>
  );
}

function DecisionSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-xs font-medium text-[#d4d4d8]">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function DecisionCard({
  decision,
  canReview,
  editing,
  draft,
  deleting,
  busy,
  fallback,
  locale,
  t,
  onShowSource,
  onStartEdit,
  onDraftChange,
  onCancelEdit,
  onSaveEdit,
  onConfirm,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  decision: Decision;
  canReview: boolean;
  editing: boolean;
  draft: string;
  deleting: boolean;
  busy: boolean;
  fallback: "ltr" | "rtl";
  locale: Locale;
  t: ReturnType<typeof useTranslations>;
  onShowSource: (seq: number) => void;
  onStartEdit: () => void;
  onDraftChange: (value: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onConfirm: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const isProposal = decision.status === "proposed";
  const timestamp = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(decision.source.at));

  return (
    <article className="min-w-0 rounded-lg border border-[#3f3f46] bg-[#18181b] p-3" data-decision-id={decision.id}>
      <div className="flex flex-wrap items-center gap-2">
        {isProposal ? (
          <span className="rounded-full bg-[#3f3f46] px-2 py-0.5 text-[11px] font-medium text-[#e4e4e7]">
            {t("needsReview")}
          </span>
        ) : (
          <span className="rounded-full bg-[#163d2a] px-2 py-0.5 text-[11px] font-medium text-[#bbf7d0]">
            {t("confirmedBadge")}
          </span>
        )}
        {decision.origin === "llm" && (
          <span className="text-[11px] text-[#fbbf24]">{t("modelGenerated")}</span>
        )}
      </div>

      {editing ? (
        <div className="mt-3">
          <label className="block text-xs font-medium text-[#d4d4d8]" htmlFor={`decision-${decision.id}`}>
            {t("wordingLabel")}
          </label>
          <textarea
            id={`decision-${decision.id}`}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            dir={lineDirection(draft, fallback)}
            className="mt-1 min-h-24 w-full resize-y rounded-md border border-[#52525b] bg-[#111113] px-3 py-2 text-sm leading-relaxed text-[#f4f4f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5]"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={busy}
              className="min-h-11 rounded-md bg-[#f4f4f5] px-3 text-sm font-medium text-[#0a0a0b] transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              {t("save")}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={busy}
              className="min-h-11 rounded-md px-3 text-sm font-medium text-[#d4d4d8] transition-colors duration-150 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <p
          dir={lineDirection(decision.text, fallback)}
          className="mt-3 wrap-anywhere text-sm font-medium leading-relaxed text-[#fafafa]"
          data-decision-text
        >
          {decision.text}
        </p>
      )}

      <figure className="mt-3 border-s-2 border-[#52525b] ps-3">
        <figcaption className="text-xs font-medium text-[#d4d4d8]">{t("sourceTitle")}</figcaption>
        <blockquote
          dir={lineDirection(decision.source.quote, fallback)}
          className="mt-1 wrap-anywhere text-sm leading-relaxed text-[#d4d4d8]"
        >
          {decision.source.quote}
        </blockquote>
        <p className="mt-2 flex flex-wrap gap-x-2 text-xs text-[#a1a1aa]">
          <bdi>{decision.source.speaker}</bdi>
          <time dateTime={decision.source.at} dir="ltr">
            <bdi>{timestamp}</bdi> <bdi>UTC</bdi>
          </time>
        </p>
        <button
          type="button"
          onClick={() => onShowSource(decision.source.seq)}
          className="mt-2 min-h-11 rounded-md px-2 text-sm font-medium text-[#d4d4d8] underline decoration-[#71717a] underline-offset-4 transition-colors duration-150 hover:text-white motion-reduce:transition-none"
        >
          {t("showSource")}
        </button>
      </figure>

      {canReview && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[#3f3f46] pt-3">
          {isProposal && !editing && (
            <>
              <button
                type="button"
                onClick={onStartEdit}
                disabled={busy}
                className="min-h-11 rounded-md px-3 text-sm font-medium text-[#d4d4d8] transition-colors duration-150 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                {t("edit")}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy || deleting}
                className="min-h-11 rounded-md bg-[#f4f4f5] px-3 text-sm font-medium text-[#0a0a0b] transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                {t("confirm")}
              </button>
            </>
          )}

          {deleting ? (
            <div className="w-full rounded-md border border-[#7f1d1d] bg-[#1c1012] p-3">
              <p className="text-sm leading-relaxed text-[#fecaca]">{t("deleteConfirm")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={busy}
                  className="min-h-11 rounded-md bg-[#f87171] px-3 text-sm font-medium text-[#0a0a0b] transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                >
                  {t("deleteNow")}
                </button>
                <button
                  type="button"
                  onClick={onCancelDelete}
                  disabled={busy}
                  className="min-h-11 rounded-md px-3 text-sm font-medium text-[#d4d4d8] transition-colors duration-150 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAskDelete}
              disabled={busy}
              className={cn(
                "min-h-11 rounded-md px-3 text-sm font-medium text-[#fca5a5] transition-colors duration-150 hover:text-[#fee2e2] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
                isProposal && !editing && "ms-auto",
              )}
            >
              {t("delete")}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
