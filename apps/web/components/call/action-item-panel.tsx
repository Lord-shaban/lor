"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { direction as localeDirection, type Locale } from "@/i18n/routing";
import { lineDirection } from "@/lib/bidi";
import { sessionId } from "@/lib/session-id";

interface ActionItem {
  id: string;
  status: "proposed" | "open" | "completed";
  origin: "manual" | "llm";
  text: string;
  /** Returned only to the verified host for its validated select option. */
  assigneeIdentity?: string | null;
  assigneeName: string | null;
  dueOn: string | null;
  createdAt: string;
  openedAt: string | null;
  completedAt: string | null;
  canComplete: boolean;
  source: {
    seq: number;
    speaker: string;
    quote: string;
    at: string;
  };
}

interface StoredActionItems {
  canReview: boolean;
  retentionDays: number;
  participants: { identity: string; name: string }[];
  actionItems: ActionItem[];
}

type Failure =
  | "no_key"
  | "quota"
  | "transcript_too_short"
  | "nothing_to_extract"
  | "timeout"
  | "unavailable"
  | "host_lost"
  | "action_item_unavailable"
  | "action_item_text_invalid"
  | "action_item_owner_invalid"
  | "action_item_due_invalid";

function failureFrom(response: Response, body: { error?: string } | null): Failure {
  if (response.status === 404) return "action_item_unavailable";
  switch (body?.error) {
    case "no_key":
    case "quota":
    case "transcript_too_short":
    case "nothing_to_extract":
    case "timeout":
    case "action_item_text_invalid":
    case "action_item_owner_invalid":
    case "action_item_due_invalid":
      return body.error;
    default:
      return "unavailable";
  }
}

function actionHeaders(): HeadersInit {
  // This bearer secret remains in the tab. The route derives the LiveKit
  // identity itself; the browser never submits an identity as a permission.
  return { "X-LOR-Session-Id": sessionId() };
}

/**
 * A review workspace for evidence-backed commitments, intentionally mounted
 * only after a person asks to open it. The source remains visually closer than
 * the status controls so a model suggestion never reads like a meeting fact.
 */
export function ActionItemPanel({
  code,
  onClose,
  onShowSource,
}: {
  code: string;
  onClose: () => void;
  onShowSource: (seq: number) => void;
}) {
  const t = useTranslations("call.actionItems");
  const locale = useLocale() as Locale;
  const fallback = localeDirection[locale];
  const [stored, setStored] = useState<StoredActionItems | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [failureId, setFailureId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [assigneeIdentity, setAssigneeIdentity] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms/${code}/action-items`, {
        headers: actionHeaders(),
      });
      if (!response.ok) throw new Error("Could not load action items");
      const latest = (await response.json()) as StoredActionItems;
      setStored(latest);
      setLoadFailed(false);
      return latest;
    } catch {
      setLoadFailed(true);
      return false;
    }
  }, [code]);

  useEffect(() => {
    // Defer this until after the panel has painted; opening a call overlay
    // should never flash an empty record before its request starts.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const proposals = useMemo(
    () => stored?.actionItems.filter((item) => item.status === "proposed") ?? [],
    [stored],
  );
  const open = useMemo(
    () => stored?.actionItems.filter((item) => item.status === "open") ?? [],
    [stored],
  );
  const completed = useMemo(
    () => stored?.actionItems.filter((item) => item.status === "completed") ?? [],
    [stored],
  );

  function isBusy(action: string, id?: string) {
    return busy === `${action}:${id ?? "room"}`;
  }

  async function mutate({
    action,
    id,
    path = `/api/rooms/${code}/action-items`,
    init,
    success,
  }: {
    action: "extract" | "open" | "complete" | "reopen" | "delete";
    id?: string;
    path?: string;
    init: RequestInit;
    success: string;
  }) {
    setBusy(`${action}:${id ?? "room"}`);
    setFailure(null);
    setFailureId(null);
    setNotice(null);
    try {
      const response = await fetch(path, {
        ...init,
        headers: { ...actionHeaders(), ...(init.headers ?? {}) },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        const latest = await load();
        setFailure(
          response.status === 404 && latest && !latest.canReview
            ? "host_lost"
            : failureFrom(response, body),
        );
        setFailureId(id ?? null);
        return false;
      }
      if (!await load()) {
        setFailure("unavailable");
        setFailureId(id ?? null);
        return false;
      }
      setNotice(success);
      return true;
    } catch {
      setFailure("unavailable");
      setFailureId(id ?? null);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function extract() {
    const succeeded = await mutate({
      action: "extract",
      path: `/api/rooms/${code}/action-items/extract`,
      init: { method: "POST" },
      success: t("extracted"),
    });
    if (succeeded) {
      setReviewingId(null);
      setDeleteConfirmation(null);
    }
  }

  function startReview(item: ActionItem) {
    setReviewingId(item.id);
    setDraft(item.text);
    setAssigneeIdentity(item.assigneeIdentity ?? "");
    setDueOn(item.dueOn ?? "");
    setFailure(null);
    setFailureId(null);
    setDeleteConfirmation(null);
  }

  async function openTask(item: ActionItem) {
    const text = draft.trim();
    if (!text) {
      setFailure("action_item_text_invalid");
      setFailureId(item.id);
      return;
    }
    if (!assigneeIdentity) {
      setFailure("action_item_owner_invalid");
      setFailureId(item.id);
      return;
    }
    if (!dueOn) {
      setFailure("action_item_due_invalid");
      setFailureId(item.id);
      return;
    }
    const succeeded = await mutate({
      action: "open",
      id: item.id,
      init: {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          action: "open",
          text,
          assigneeIdentity,
          dueOn,
        }),
      },
      success: t("opened"),
    });
    if (succeeded) setReviewingId(null);
  }

  async function complete(item: ActionItem) {
    await mutate({
      action: "complete",
      id: item.id,
      init: {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action: "complete" }),
      },
      success: t("completed"),
    });
  }

  async function reopen(item: ActionItem) {
    await mutate({
      action: "reopen",
      id: item.id,
      init: {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action: "reopen" }),
      },
      success: t("reopened"),
    });
  }

  async function remove(item: ActionItem) {
    const succeeded = await mutate({
      action: "delete",
      id: item.id,
      init: {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      },
      success: t("deleted"),
    });
    if (succeeded) setDeleteConfirmation(null);
  }

  return (
    <aside
      className="absolute end-0 inset-y-0 z-30 flex w-full max-w-md flex-col border-s border-[#27272a] bg-[#111113]"
      aria-label={t("title")}
      data-testid="action-item-panel"
    >
      <header className="flex items-center justify-between gap-3 border-b border-[#27272a] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#fafafa]">{t("title")}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-[#a1a1aa]">{t("intro")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 shrink-0 rounded-md px-3 text-sm font-medium text-[#a1a1aa] transition-colors duration-150 hover:text-[#fafafa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
        >
          {t("close")}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4" aria-busy={busy !== null}>
        <div aria-live="polite" aria-atomic="true" className="mb-3">
          {notice && <p className="text-sm text-[#bbf7d0]">{notice}</p>}
          {failure && failureId === null && (
            <p role="alert" className="text-sm leading-relaxed text-[#fca5a5]">{t(`error.${failure}`)}</p>
          )}
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
              className="mt-2 min-h-11 rounded-md px-3 text-sm font-medium text-[#f4f4f5] underline decoration-[#f87171] underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
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
                  className="mt-3 min-h-11 rounded-md bg-[#f4f4f5] px-4 text-sm font-medium text-[#0a0a0b] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                >
                  {isBusy("extract") ? t("extracting") : t("extract")}
                </button>
              </section>
            )}

            {stored.canReview && proposals.length > 0 && (
              <ActionSection title={t("proposals")}>
                {proposals.map((item) => (
                  <ActionItemCard
                    key={item.id}
                    item={item}
                    canReview={stored.canReview}
                    participants={stored.participants}
                    reviewing={reviewingId === item.id}
                    draft={draft}
                    assigneeIdentity={assigneeIdentity}
                    dueOn={dueOn}
                    deleting={deleteConfirmation === item.id}
                    busy={busy !== null}
                    failure={failureId === item.id ? failure : null}
                    fallback={fallback}
                    locale={locale}
                    t={t}
                    onShowSource={onShowSource}
                    onStartReview={() => startReview(item)}
                    onDraftChange={setDraft}
                    onAssigneeChange={setAssigneeIdentity}
                    onDueChange={setDueOn}
                    onCancelReview={() => setReviewingId(null)}
                    onOpen={() => void openTask(item)}
                    onComplete={() => undefined}
                    onReopen={() => undefined}
                    onAskDelete={() => {
                      setDeleteConfirmation(item.id);
                      setReviewingId(null);
                    }}
                    onCancelDelete={() => setDeleteConfirmation(null)}
                    onDelete={() => void remove(item)}
                  />
                ))}
              </ActionSection>
            )}

            {open.length > 0 && (
              <ActionSection title={t("openTitle")}>
                {open.map((item) => (
                  <ActionItemCard
                    key={item.id}
                    item={item}
                    canReview={stored.canReview}
                    participants={[]}
                    reviewing={false}
                    draft=""
                    assigneeIdentity=""
                    dueOn=""
                    deleting={deleteConfirmation === item.id}
                    busy={busy !== null}
                    failure={failureId === item.id ? failure : null}
                    fallback={fallback}
                    locale={locale}
                    t={t}
                    onShowSource={onShowSource}
                    onStartReview={() => undefined}
                    onDraftChange={() => undefined}
                    onAssigneeChange={() => undefined}
                    onDueChange={() => undefined}
                    onCancelReview={() => undefined}
                    onOpen={() => undefined}
                    onComplete={() => void complete(item)}
                    onReopen={() => undefined}
                    onAskDelete={() => setDeleteConfirmation(item.id)}
                    onCancelDelete={() => setDeleteConfirmation(null)}
                    onDelete={() => void remove(item)}
                  />
                ))}
              </ActionSection>
            )}

            {completed.length > 0 && (
              <ActionSection title={t("completedTitle")}>
                {completed.map((item) => (
                  <ActionItemCard
                    key={item.id}
                    item={item}
                    canReview={stored.canReview}
                    participants={[]}
                    reviewing={false}
                    draft=""
                    assigneeIdentity=""
                    dueOn=""
                    deleting={deleteConfirmation === item.id}
                    busy={busy !== null}
                    failure={failureId === item.id ? failure : null}
                    fallback={fallback}
                    locale={locale}
                    t={t}
                    onShowSource={onShowSource}
                    onStartReview={() => undefined}
                    onDraftChange={() => undefined}
                    onAssigneeChange={() => undefined}
                    onDueChange={() => undefined}
                    onCancelReview={() => undefined}
                    onOpen={() => undefined}
                    onComplete={() => undefined}
                    onReopen={() => void reopen(item)}
                    onAskDelete={() => setDeleteConfirmation(item.id)}
                    onCancelDelete={() => setDeleteConfirmation(null)}
                    onDelete={() => void remove(item)}
                  />
                ))}
              </ActionSection>
            )}

            {stored.actionItems.length === 0 && (
              <p className="max-w-sm text-sm leading-relaxed text-[#a1a1aa]">
                {stored.canReview ? t("emptyHost") : t("emptyGuest")}
              </p>
            )}
          </>
        )}
      </div>

      <footer className="border-t border-[#27272a] px-4 py-3">
        <p className="mb-2 text-[11px] leading-relaxed text-[#a1a1aa]">{t("sessionBoundary")}</p>
        <p className="text-[11px] leading-relaxed text-[#71717a]">
          {t("retention", { days: stored?.retentionDays ?? 30 })}
        </p>
      </footer>
    </aside>
  );
}

function ActionSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-xs font-medium text-[#d4d4d8]">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function ActionItemCard({
  item,
  canReview,
  participants,
  reviewing,
  draft,
  assigneeIdentity,
  dueOn,
  deleting,
  busy,
  failure,
  fallback,
  locale,
  t,
  onShowSource,
  onStartReview,
  onDraftChange,
  onAssigneeChange,
  onDueChange,
  onCancelReview,
  onOpen,
  onComplete,
  onReopen,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  item: ActionItem;
  canReview: boolean;
  participants: { identity: string; name: string }[];
  reviewing: boolean;
  draft: string;
  assigneeIdentity: string;
  dueOn: string;
  deleting: boolean;
  busy: boolean;
  failure: Failure | null;
  fallback: "ltr" | "rtl";
  locale: Locale;
  t: ReturnType<typeof useTranslations>;
  onShowSource: (seq: number) => void;
  onStartReview: () => void;
  onDraftChange: (value: string) => void;
  onAssigneeChange: (value: string) => void;
  onDueChange: (value: string) => void;
  onCancelReview: () => void;
  onOpen: () => void;
  onComplete: () => void;
  onReopen: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const errorId = `action-error-${item.id}`;
  const timestamp = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(item.source.at));
  const formattedDueOn = item.dueOn
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(`${item.dueOn}T00:00:00Z`))
    : t("notSet");

  return (
    <article className="min-w-0 rounded-lg border border-[#3f3f46] bg-[#18181b] p-3" data-action-item-id={item.id}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={item.status} t={t} />
        {item.origin === "llm" && (
          <span className="text-[11px] text-[#fbbf24]">{t("modelGenerated")}</span>
        )}
      </div>

      {reviewing ? (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#d4d4d8]" htmlFor={`action-text-${item.id}`}>
              {t("wordingLabel")}
            </label>
            <textarea
              id={`action-text-${item.id}`}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              dir={lineDirection(draft, fallback)}
              aria-invalid={failure === "action_item_text_invalid"}
              aria-describedby={failure ? errorId : undefined}
              className="mt-1 min-h-24 w-full resize-y rounded-md border border-[#52525b] bg-[#111113] px-3 py-2 text-sm leading-relaxed text-[#f4f4f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#d4d4d8]" htmlFor={`action-owner-${item.id}`}>
              {t("ownerLabel")}
            </label>
            <select
              id={`action-owner-${item.id}`}
              value={assigneeIdentity}
              onChange={(event) => onAssigneeChange(event.target.value)}
              aria-invalid={failure === "action_item_owner_invalid"}
              aria-describedby={failure ? errorId : undefined}
              className="mt-1 min-h-11 w-full rounded-md border border-[#52525b] bg-[#111113] px-3 text-sm text-[#f4f4f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5]"
            >
              <option value="">{t("chooseOwner")}</option>
              {participants.map((participant) => (
                <option key={participant.identity} value={participant.identity}>
                  {participant.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#d4d4d8]" htmlFor={`action-due-${item.id}`}>
              {t("dueLabel")}
            </label>
            <input
              id={`action-due-${item.id}`}
              type="date"
              value={dueOn}
              onChange={(event) => onDueChange(event.target.value)}
              aria-invalid={failure === "action_item_due_invalid"}
              aria-describedby={failure ? errorId : undefined}
              className="mt-1 min-h-11 w-full rounded-md border border-[#52525b] bg-[#111113] px-3 text-sm text-[#f4f4f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5]"
            />
            <p className="mt-1 text-[11px] leading-relaxed text-[#a1a1aa]">{t("dueHint")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpen}
              disabled={busy}
              className="min-h-11 rounded-md bg-[#f4f4f5] px-3 text-sm font-medium text-[#0a0a0b] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              {t("open")}
            </button>
            <button
              type="button"
              onClick={onCancelReview}
              disabled={busy}
              className="min-h-11 rounded-md px-3 text-sm font-medium text-[#d4d4d8] transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <p
          dir={lineDirection(item.text, fallback)}
          className="mt-3 wrap-anywhere text-sm font-medium leading-relaxed text-[#fafafa]"
          data-action-item-text
        >
          {item.text}
        </p>
      )}

      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-y border-[#3f3f46] py-3 text-xs">
        <dt className="text-[#a1a1aa]">{t("owner")}</dt>
        <dd className="min-w-0 text-[#e4e4e7]"><bdi>{item.assigneeName ?? t("notSet")}</bdi></dd>
        <dt className="text-[#a1a1aa]">{t("due")}</dt>
        <dd className="text-[#e4e4e7]"><time dateTime={item.dueOn ?? undefined} dir="ltr"><bdi>{formattedDueOn}</bdi></time></dd>
      </dl>

      <figure className="mt-3 border-s-2 border-[#52525b] ps-3">
        <figcaption className="text-xs font-medium text-[#d4d4d8]">{t("sourceTitle")}</figcaption>
        <blockquote
          dir={lineDirection(item.source.quote, fallback)}
          className="mt-1 wrap-anywhere text-sm leading-relaxed text-[#d4d4d8]"
        >
          {item.source.quote}
        </blockquote>
        <p className="mt-2 flex flex-wrap gap-x-2 text-xs text-[#a1a1aa]">
          <bdi>{item.source.speaker}</bdi>
          <time dateTime={item.source.at} dir="ltr">
            <bdi>{timestamp}</bdi> <bdi>UTC</bdi>
          </time>
        </p>
        <button
          type="button"
          onClick={() => onShowSource(item.source.seq)}
          className="mt-2 min-h-11 rounded-md px-2 text-sm font-medium text-[#d4d4d8] underline decoration-[#71717a] underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
        >
          {t("showSource")}
        </button>
      </figure>

      {failure && (
        <p id={errorId} role="alert" className="mt-3 text-sm leading-relaxed text-[#fca5a5]">{t(`error.${failure}`)}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-[#3f3f46] pt-3">
        {canReview && item.status === "proposed" && !reviewing && (
          <button
            type="button"
            onClick={onStartReview}
            disabled={busy}
            className="min-h-11 rounded-md bg-[#f4f4f5] px-3 text-sm font-medium text-[#0a0a0b] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            {t("review")}
          </button>
        )}
        {item.status === "open" && item.canComplete && (
          <button
            type="button"
            onClick={onComplete}
            disabled={busy}
            className="min-h-11 rounded-md bg-[#f4f4f5] px-3 text-sm font-medium text-[#0a0a0b] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            {t("complete")}
          </button>
        )}
        {canReview && item.status === "completed" && (
          <button
            type="button"
            onClick={onReopen}
            disabled={busy}
            className="min-h-11 rounded-md px-3 text-sm font-medium text-[#d4d4d8] transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            {t("reopen")}
          </button>
        )}
        {canReview && !deleting && (
          <button
            type="button"
            onClick={onAskDelete}
            disabled={busy}
            className="min-h-11 rounded-md px-3 text-sm font-medium text-[#fca5a5] transition-colors duration-150 hover:text-[#fecaca] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            {t("delete")}
          </button>
        )}
        {deleting && (
          <div className="w-full rounded-md border border-[#7f1d1d] bg-[#1c1012] p-3">
            <p className="text-sm leading-relaxed text-[#fecaca]">{t("deleteConfirm")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="min-h-11 rounded-md bg-[#f87171] px-3 text-sm font-medium text-[#0a0a0b] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                {t("deleteNow")}
              </button>
              <button
                type="button"
                onClick={onCancelDelete}
                disabled={busy}
                className="min-h-11 rounded-md px-3 text-sm font-medium text-[#d4d4d8] transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: ActionItem["status"];
  t: ReturnType<typeof useTranslations>;
}) {
  const className = status === "proposed"
    ? "bg-[#3f3f46] text-[#e4e4e7]"
    : status === "open"
      ? "bg-[#1d4e63] text-[#bae6fd]"
      : "bg-[#163d2a] text-[#bbf7d0]";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {t(`status.${status}`)}
    </span>
  );
}
