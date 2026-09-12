"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { direction as localeDirection, type Locale } from "@/i18n/routing";
import { lineDirection } from "@/lib/bidi";
import { recordingOffsetAt } from "@/lib/recording-seek";
import { sessionId } from "@/lib/session-id";
import { TimelineRecordingPlayer } from "./timeline-recording-player";
import type { LocalRecording, LocalRecordingPlayback } from "./use-local-recording";

interface Occurrence {
  id: string;
  startedAt: string;
}

interface ManualMoment {
  id: string;
  label: string | null;
  at: string;
}

interface Chapter {
  id: string;
  title: string;
  start: { seq: number; at: string };
  end: { seq: number; at: string };
}

interface GeneratedMoment {
  id: string;
  source: { seq: number; at: string };
}

interface TimelineAvailable {
  state: "available";
  occurrence: Occurrence;
  moments: ManualMoment[];
  chapters: Chapter[];
  generatedMoments: GeneratedMoment[];
  talkTime: {
    kind: "retained_caption_vad_span";
    unit: "ms";
    speakers: { identity: string; name: string; durationMs: number }[];
  };
}

interface TimelineUnavailable {
  state: "unavailable";
  reason: "occurrence_unavailable" | "record_unavailable";
  occurrence: null;
  moments: [];
  chapters: [];
  generatedMoments: [];
  talkTime: TimelineAvailable["talkTime"];
}

type Timeline = TimelineAvailable | TimelineUnavailable;
type BusyAction = "mark" | "generate" | null;
type PlaybackUnavailable =
  | "no-local-recording"
  | "recording-in-progress"
  | "before-recording"
  | "after-recording"
  | "invalid"
  | "media-unavailable";
type PlaybackState =
  | {
      kind: "open";
      playback: LocalRecordingPlayback;
      offsetMs: number;
      selectedTime: string;
    }
  | { kind: "unavailable"; reason: PlaybackUnavailable }
  | null;

type NavigationItem =
  | { kind: "chapter"; at: string; item: Chapter }
  | { kind: "manual"; at: string; item: ManualMoment }
  | { kind: "generated"; at: string; item: GeneratedMoment };

function errorFrom(response: Response, body: unknown): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  if (typeof body === "object" && body !== null && "reason" in body) {
    const reason = (body as { reason?: unknown }).reason;
    if (reason === "occurrence_unavailable" || reason === "record_unavailable") return reason;
  }
  return response.status === 429 ? "quota" : "unavailable";
}

/** Time elapsed from the server-created occurrence boundary, never browser time. */
function elapsed(at: string, startedAt: string, locale: Locale): string {
  return elapsedDuration(Math.max(0, new Date(at).getTime() - new Date(startedAt).getTime()), locale);
}

/** A retained VAD duration is already a duration, not a date on this browser. */
function elapsedDuration(milliseconds: number, locale: Locale): string {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const language = locale === "ar" ? "ar-EG" : "en-GB";
  const number = new Intl.NumberFormat(language, { useGrouping: false });
  const paddedSeconds = new Intl.NumberFormat(language, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  return `${number.format(minutes)}:${paddedSeconds.format(seconds)}`;
}

function navigationItems(timeline: TimelineAvailable): NavigationItem[] {
  return [
    ...timeline.chapters.map((item): NavigationItem => ({ kind: "chapter", at: item.start.at, item })),
    ...timeline.moments.map((item): NavigationItem => ({ kind: "manual", at: item.at, item })),
    ...timeline.generatedMoments.map((item): NavigationItem => ({ kind: "generated", at: item.source.at, item })),
  ].toSorted((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/**
 * An on-demand navigation workspace. It mounts only after the Timeline entry
 * is used, so opening a room never fetches or bundles a second record view.
 */
export function TimelinePanel({
  code,
  isHost,
  revision,
  recording,
  onClose,
  onShowSource,
  onTimelineChanged,
}: {
  code: string;
  isHost: boolean;
  /** A peer committed a marker; refetch durable state while this panel is open. */
  revision: number;
  recording: LocalRecording;
  onClose: () => void;
  onShowSource: (seq: number) => void;
  onTimelineChanged: () => void;
}) {
  const t = useTranslations("call.timeline");
  const locale = useLocale() as Locale;
  const fallback = localeDirection[locale];
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const playbackRef = useRef<LocalRecordingPlayback | null>(null);
  const playbackTriggerRef = useRef<HTMLButtonElement | null>(null);

  // The trigger sits after this lazy panel in DOM order. Moving focus into the
  // visible workspace keeps Tab navigation aligned with what has just opened.
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms/${code}/timeline`);
      if (!response.ok) throw new Error("unavailable");
      setTimeline((await response.json()) as Timeline);
      setFailure(null);
    } catch {
      setFailure("unavailable");
    }
  }, [code]);

  useEffect(() => {
    // Schedule the first request so opening a panel paints its stable shell
    // before data state changes. Subsequent revisions are the same safe GET.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load, revision]);

  const releasePlayback = useCallback((restoreFocus = false) => {
    playbackRef.current?.release();
    playbackRef.current = null;
    setPlayback(null);
    if (restoreFocus) requestAnimationFrame(() => playbackTriggerRef.current?.focus());
  }, []);

  const showPlaybackUnavailable = useCallback((reason: PlaybackUnavailable, restoreFocus = false) => {
    playbackRef.current?.release();
    playbackRef.current = null;
    setPlayback({ kind: "unavailable", reason });
    if (restoreFocus) requestAnimationFrame(() => playbackTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    return () => playbackRef.current?.release();
  }, []);

  const openLocalPlayback = useCallback((at: string, selectedTime: string, trigger: HTMLButtonElement) => {
    playbackTriggerRef.current = trigger;
    if (recording.status === "recording" || recording.status === "stopping") {
      showPlaybackUnavailable("recording-in-progress");
      return;
    }

    const candidate = recording.openPlayback();
    if (!candidate) {
      showPlaybackUnavailable("no-local-recording");
      return;
    }

    const offset = recordingOffsetAt({
      startedAt: candidate.startedAt,
      endedAt: candidate.endedAt,
      momentAt: new Date(at).getTime(),
    });
    if (offset.kind !== "seekable") {
      candidate.release();
      showPlaybackUnavailable(offset.kind);
      return;
    }

    playbackRef.current?.release();
    playbackRef.current = candidate;
    setPlayback({ kind: "open", playback: candidate, offsetMs: offset.offsetMs, selectedTime });
  }, [recording, showPlaybackUnavailable]);

  const handleMediaUnavailable = useCallback(
    () => showPlaybackUnavailable("media-unavailable", true),
    [showPlaybackUnavailable],
  );

  const available = timeline?.state === "available" ? timeline : null;
  const activePlayback = playback?.kind === "open"
    && playback.playback.generation === recording.playbackGeneration
    ? playback
    : null;
  const entries = useMemo(
    () => (available ? navigationItems(available) : []),
    [available],
  );

  const mark = useCallback(async () => {
    if (!available || busy !== null) return;
    setBusy("mark");
    setFailure(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/rooms/${code}/timeline`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-LOR-Session-Id": sessionId(),
        },
        body: JSON.stringify({}),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setFailure(errorFrom(response, body));
        return;
      }
      const created = body as { occurrence?: Occurrence; moment?: ManualMoment };
      if (!created.occurrence || !created.moment) {
        setFailure("unavailable");
        return;
      }
      if (created.occurrence.id !== available.occurrence.id) {
        await load();
      } else {
        setTimeline((current) => current?.state === "available"
          ? {
            ...current,
            moments: [...current.moments, created.moment!].toSorted(
              (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
            ),
          }
          : current);
      }
      onTimelineChanged();
      setNotice(t("marked"));
    } catch {
      setFailure("unavailable");
    } finally {
      setBusy(null);
    }
  }, [available, busy, code, load, onTimelineChanged, t]);

  const generate = useCallback(async () => {
    if (!available || !isHost || busy !== null) return;
    setBusy("generate");
    setFailure(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/rooms/${code}/timeline/generate`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setFailure(errorFrom(response, body));
        return;
      }
      await load();
      // Generated navigation is also durable server state. Existing peer
      // panels receive the same data-free refetch signal as a manual marker.
      onTimelineChanged();
      setNotice(t("generatedNotice"));
    } catch {
      setFailure("unavailable");
    } finally {
      setBusy(null);
    }
  }, [available, busy, code, isHost, load, onTimelineChanged, t]);

  return (
    <aside
      data-testid="timeline-panel"
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

      <div className="flex-1 overflow-y-auto px-4 py-4" aria-busy={timeline === null || busy !== null}>
        <div aria-live="polite" aria-atomic="true" className="mb-3">
          {notice && <p className="text-sm text-[#bbf7d0]">{notice}</p>}
          {failure && timeline !== null && (
            <p role="alert" className="text-sm leading-relaxed text-[#fca5a5]">{t(`error.${failure}`)}</p>
          )}
          {playback?.kind === "unavailable" && (
            <p role="alert" className="text-sm leading-relaxed text-[#fbbf24]">
              {t(`localRecording.unavailable.${playback.reason}`)}
            </p>
          )}
        </div>

        {timeline === null && !failure && (
          <div className="space-y-3" aria-label={t("loading")}>
            <div className="h-16 animate-pulse rounded-lg bg-[#1e1e21] motion-reduce:animate-none" />
            <div className="h-24 animate-pulse rounded-lg bg-[#1e1e21] motion-reduce:animate-none" />
          </div>
        )}

        {timeline === null && failure && (
          <FailureState failure={failure} onRetry={() => void load()} t={t} />
        )}

        {timeline?.state === "unavailable" && (
          <section className="rounded-lg border border-[#3f3f46] bg-[#18181b] p-4">
            <h3 className="text-sm font-medium text-[#f4f4f5]">{t("unavailableTitle")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">
              {t(`unavailable.${timeline.reason}`)}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 min-h-11 rounded-md px-3 text-sm font-medium text-[#f4f4f5] underline decoration-[#71717a] underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
            >
              {t("retry")}
            </button>
          </section>
        )}

        {available && (
          <>
            {activePlayback && (
              <TimelineRecordingPlayer
                playback={activePlayback.playback}
                offsetMs={activePlayback.offsetMs}
                selectedTime={activePlayback.selectedTime}
                onClose={() => releasePlayback(true)}
                onUnavailable={handleMediaUnavailable}
              />
            )}

            <section className="mb-5 rounded-lg border border-[#3f3f46] bg-[#18181b] p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-[#f4f4f5]">{t("markTitle")}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#a1a1aa]">{t("markHint")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void mark()}
                  disabled={busy !== null}
                  className="min-h-11 shrink-0 rounded-md bg-[#f4f4f5] px-4 text-sm font-medium text-[#0a0a0b] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                >
                  {busy === "mark" ? t("marking") : t("mark")}
                </button>
              </div>
            </section>

            {isHost && (
              <section className="mb-5 rounded-lg border border-[#3f3f46] bg-[#18181b] p-3">
                <h3 className="text-sm font-medium text-[#f4f4f5]">{t("generateTitle")}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#a1a1aa]">{t("generateHint")}</p>
                <button
                  type="button"
                  onClick={() => void generate()}
                  disabled={busy !== null}
                  className="mt-3 min-h-11 rounded-md px-4 text-sm font-medium text-[#d4d4d8] underline decoration-[#71717a] underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                >
                  {busy === "generate" ? t("generating") : t("generate")}
                </button>
              </section>
            )}

            <section aria-labelledby="timeline-navigation-title">
              <h3 id="timeline-navigation-title" className="mb-3 text-sm font-medium text-[#f4f4f5]">
                {t("navigationTitle")}
              </h3>
              {entries.length === 0 ? (
                <p className="max-w-sm text-sm leading-relaxed text-[#a1a1aa]">
                  {isHost ? t("emptyHost") : t("emptyGuest")}
                </p>
              ) : (
                <ol className="relative space-y-3 border-s border-[#3f3f46] ps-4">
                  {entries.map((entry) => (
                    <TimelineEntry
                      key={`${entry.kind}-${entry.item.id}`}
                      entry={entry}
                      startedAt={available.occurrence.startedAt}
                      locale={locale}
                      fallback={fallback}
                      t={t}
                      onShowSource={onShowSource}
                      onOpenLocalPlayback={openLocalPlayback}
                    />
                  ))}
                </ol>
              )}
            </section>

            <TalkTime speakers={available.talkTime.speakers} locale={locale} t={t} />
          </>
        )}
      </div>
    </aside>
  );
}

function FailureState({
  failure,
  onRetry,
  t,
}: {
  failure: string;
  onRetry: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="rounded-lg border border-[#7f1d1d] bg-[#1c1012] p-3">
      <p role="alert" className="text-sm leading-relaxed text-[#fecaca]">{t(`error.${failure}`)}</p>
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

function TimelineEntry({
  entry,
  startedAt,
  locale,
  fallback,
  t,
  onShowSource,
  onOpenLocalPlayback,
}: {
  entry: NavigationItem;
  startedAt: string;
  locale: Locale;
  fallback: "rtl" | "ltr";
  t: ReturnType<typeof useTranslations>;
  onShowSource: (seq: number) => void;
  onOpenLocalPlayback: (at: string, selectedTime: string, trigger: HTMLButtonElement) => void;
}) {
  const time = elapsed(entry.at, startedAt, locale);
  const label = entry.kind === "chapter"
    ? t("chapter")
    : entry.kind === "manual"
      ? t("manual")
      : t("generated");

  return (
    <li className="relative min-w-0">
      <span aria-hidden="true" className="absolute -start-[1.3125rem] top-5 size-2.5 rounded-full border-2 border-[#111113] bg-[#a1a1aa]" />
      <article className="min-w-0 rounded-lg border border-[#3f3f46] bg-[#18181b] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-[#27272a] px-2 py-0.5 text-[11px] font-medium text-[#d4d4d8]">{label}</span>
          <time dateTime={entry.at} dir="ltr" className="text-xs font-medium text-[#a1a1aa]">
            <bdi>+{time}</bdi>
          </time>
        </div>

        {entry.kind === "chapter" && (
          <>
            <h4 dir={lineDirection(entry.item.title, fallback)} className="mt-3 wrap-anywhere text-sm font-medium leading-relaxed text-[#fafafa]">
              {entry.item.title}
            </h4>
            <p className="mt-2 text-xs text-[#a1a1aa]">
              {t("chapterRange", { start: entry.item.start.seq, end: entry.item.end.seq })}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => onShowSource(entry.item.start.seq)} className="min-h-11 rounded-md px-2 text-sm font-medium text-[#d4d4d8] underline decoration-[#71717a] underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none">
                {t("showStart")}
              </button>
              <button type="button" onClick={() => onShowSource(entry.item.end.seq)} className="min-h-11 rounded-md px-2 text-sm font-medium text-[#d4d4d8] underline decoration-[#71717a] underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none">
                {t("showEnd")}
              </button>
            </div>
          </>
        )}

        {entry.kind === "manual" && (
          <p dir={entry.item.label ? lineDirection(entry.item.label, fallback) : undefined} className="mt-3 wrap-anywhere text-sm leading-relaxed text-[#f4f4f5]">
            {entry.item.label ?? t("manualUntitled")}
          </p>
        )}

        {entry.kind === "generated" && (
          <>
            <p className="mt-3 text-sm leading-relaxed text-[#f4f4f5]">{t("generatedMoment")}</p>
            <button type="button" onClick={() => onShowSource(entry.item.source.seq)} className="mt-2 min-h-11 rounded-md px-2 text-sm font-medium text-[#d4d4d8] underline decoration-[#71717a] underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none">
              {t("showSource")}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={(event) => onOpenLocalPlayback(entry.at, `+${time}`, event.currentTarget)}
          className="mt-2 min-h-11 rounded-md px-2 text-sm font-medium text-[#d4d4d8] underline decoration-[#71717a] underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] motion-reduce:transition-none"
        >
          {t("localRecording.open")}
        </button>
      </article>
    </li>
  );
}

function TalkTime({
  speakers,
  locale,
  t,
}: {
  speakers: TimelineAvailable["talkTime"]["speakers"];
  locale: Locale;
  t: ReturnType<typeof useTranslations>;
}) {
  const largest = Math.max(1, ...speakers.map((speaker) => speaker.durationMs));
  return (
    <section className="mt-7 border-t border-[#27272a] pt-5" aria-labelledby="timeline-talk-time-title">
      <h3 id="timeline-talk-time-title" className="text-sm font-medium text-[#f4f4f5]">{t("talkTimeTitle")}</h3>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#a1a1aa]">{t("talkTimeHint")}</p>
      {speakers.length === 0 ? (
        <p className="mt-3 text-sm text-[#a1a1aa]">{t("talkTimeEmpty")}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {speakers.map((speaker) => (
            <li key={speaker.identity} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <bdi className="min-w-0 truncate font-medium text-[#e4e4e7]">{speaker.name}</bdi>
                <time dir="ltr" className="shrink-0 text-[#d4d4d8]">
                  <bdi>{elapsedDuration(speaker.durationMs, locale)}</bdi>
                </time>
              </div>
              <div aria-hidden="true" className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#27272a]">
                <div className="h-full rounded-full bg-[#a1a1aa]" style={{ width: `${Math.max(6, (speaker.durationMs / largest) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
