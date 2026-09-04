"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { direction as localeDirection, type Locale } from "@/i18n/routing";
import type { ChatEntry } from "@/lib/chat-log";
import { lineDirection } from "@/lib/bidi";
import { MAX_CHAT_LENGTH } from "@/lib/data-channel";
import { linkify } from "@/lib/linkify";
import { cn } from "@/lib/cn";

/** Close enough to the bottom that new messages should still follow. */
const PINNED_SLACK_PX = 40;

/**
 * The chat.
 *
 * A flat log rather than bubbles, on purpose. Bubbles need a side, a side means
 * a direction, and half the messages in this product are Arabic while the other
 * half are English — often in the same sentence. A flat log with the sender
 * named is the one layout that reads correctly either way.
 */
export function ChatPanel({
  entries,
  onSend,
  onClose,
}: {
  entries: readonly ChatEntry[];
  /** Rejects by throwing, so the draft survives a failed send. */
  onSend: (body: string) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations("call");
  const format = useFormatter();

  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Whether the log was scrolled to the bottom before this message arrived. A
  // chat that yanks you back down while you are reading is worse than one that
  // makes you scroll.
  const pinnedRef = useRef(true);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  // The panel only exists while it is open, so this runs on open.
  useEffect(() => {
    composerRef.current?.focus();
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (list && pinnedRef.current) list.scrollTop = list.scrollHeight;
  }, [entries.length]);

  async function submit() {
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setFailed(false);
    try {
      await onSend(body);
      setDraft("");
      // Sending always returns you to the bottom: you are the reason it moved.
      pinnedRef.current = true;
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <aside
      aria-label={t("chat.title")}
      // Full screen on a phone, a column beside the grid from md up. The video
      // grid measures its own container, so taking width from it here is all
      // the relayout it needs.
      className={cn(
        "absolute inset-0 z-20 flex flex-col bg-[#0a0a0b]",
        "md:static md:z-auto md:w-80 md:shrink-0 md:border-s md:border-[#2a2a2e]",
      )}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-[#2a2a2e] px-4 py-3">
        <h2 className="text-sm font-medium text-[#f4f4f5]">{t("chat.title")}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("chat.close")}
          className="h-9 rounded-md px-3 text-sm text-[#a1a1aa] transition-colors duration-150 hover:bg-[#1e1e21] hover:text-[#f4f4f5]"
        >
          {t("chat.closeShort")}
        </button>
      </header>

      <div
        ref={listRef}
        onScroll={() => {
          const list = listRef.current;
          if (!list) return;
          pinnedRef.current =
            list.scrollHeight - list.scrollTop - list.clientHeight <
            PINNED_SLACK_PX;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
      >
        {/* Said once, at the top, rather than left to be inferred. Someone who
            joins halfway through an argument should not read an empty panel as
            "nobody has said anything". */}
        <p className="pb-3 text-xs text-[#71717a]">{t("chat.noHistory")}</p>

        {entries.length === 0 ? (
          <p className="text-sm text-[#a1a1aa]">{t("chat.empty")}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {entries.map((entry, index) => (
              <Message
                key={entry.key}
                entry={entry}
                // Consecutive messages from one person read as one turn, so the
                // name is printed when the speaker changes and not before.
                showSender={entries[index - 1]?.identity !== entry.identity}
                time={format.dateTime(new Date(entry.at), {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              />
            ))}
          </ol>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="shrink-0 border-t border-[#2a2a2e] p-3"
      >
        {failed && (
          <p role="alert" className="pb-2 text-xs text-[#f87171]">
            {t("chat.sendFailed")}
          </p>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={composerRef}
            rows={1}
            value={draft}
            // dir="auto" here and nowhere else in this file. A sent message is
            // measured, because a finished sentence knows what language it is
            // in; a draft is not, because measuring one would re-align the box
            // and move the caret under the typist as the balance of words
            // shifted. First strong character is the right answer for an input
            // and the wrong one for a paragraph.
            dir="auto"
            maxLength={MAX_CHAT_LENGTH}
            placeholder={t("chat.placeholder")}
            aria-label={t("chat.placeholder")}
            onChange={(event) => {
              setDraft(event.target.value);
              // Grow with the text up to a few lines. Written to the element
              // rather than held in state: it is a measurement, not data.
              const box = event.target;
              box.style.height = "auto";
              box.style.height = `${Math.min(box.scrollHeight, 128)}px`;
            }}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter breaks the line. isComposing keeps an
              // IME's Enter — which commits a candidate — from sending half a
              // word.
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void submit();
              }
            }}
            className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-md bg-[#141416] px-3 py-2.5 text-sm text-[#f4f4f5] placeholder:text-[#71717a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5]"
          />

          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="h-11 shrink-0 rounded-md bg-[#f4f4f5] px-4 text-sm font-medium text-[#0a0a0b] transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("chat.send")}
          </button>
        </div>
      </form>
    </aside>
  );
}

function Message({
  entry,
  showSender,
  time,
}: {
  entry: ChatEntry;
  showSender: boolean;
  time: string;
}) {
  const t = useTranslations("call");
  const locale = useLocale() as Locale;

  // Which way this message runs, decided from the words in it rather than from
  // its first strong character. A sentence that opens with an English term is
  // still an Arabic sentence, and dir="auto" would lay it out backwards and put
  // the full stop on the wrong side.
  const direction = lineDirection(entry.body, localeDirection[locale]);

  return (
    <li>
      {showSender && (
        <p className="flex items-baseline gap-2 pt-1 text-xs text-[#a1a1aa]">
          {/* Only the name is isolated, never the "(you)" with it. Wrapping
              both together makes the whole run take the name's direction, and
              an Arabic name in an English call then renders as "(you) سارة" —
              seen on screen, not guessed at. */}
          <span className="min-w-0 truncate font-medium text-[#d4d4d8]">
            {entry.mine ? (
              t.rich("youLabel", {
                name: entry.name,
                n: (chunks) => <bdi>{chunks}</bdi>,
              })
            ) : (
              <bdi>{entry.name}</bdi>
            )}
          </span>
          <bdi className="shrink-0 tabular-nums">{time}</bdi>
        </p>
      )}

      {/* The interface language says nothing about what someone typed, so the
          message carries its own direction — but a measured one, not
          dir="auto". overflow-wrap:anywhere is what stops a pasted URL or an
          unbroken 200-character word from widening the whole panel. */}
      <p
        dir={direction}
        className="whitespace-pre-wrap text-sm text-[#f4f4f5] [overflow-wrap:anywhere]"
      >
        {linkify(entry.body).map((segment, index) =>
          segment.href ? (
            // The segment is text either way; only the anchor is added. Nothing
            // a participant types is ever parsed as markup.
            <bdi key={index}>
              <a
                href={segment.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline decoration-[#71717a] underline-offset-2 hover:decoration-[#f4f4f5]"
              >
                {segment.text}
              </a>
            </bdi>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
      </p>
    </li>
  );
}
