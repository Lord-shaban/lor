"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeRoomCode } from "@/lib/room-code";

/**
 * The front door: start a meeting, or join one you were sent.
 *
 * Both paths answer the same question — "how do I get into a room?" — so they
 * stay together in one labelled surface while the new-room path remains the
 * first, strongest action.
 */
export function RoomLauncher() {
  const t = useTranslations("launcher");
  const locale = useLocale();
  const router = useRouter();

  const [creating, setCreating] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function createRoom() {
    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });

      if (response.status === 429) {
        setCreateError(t("errors.tooMany"));
        return;
      }
      if (!response.ok) {
        setCreateError(t("errors.createFailed"));
        return;
      }

      const { code } = (await response.json()) as { code: string };
      router.push(`/${code}`);
    } catch {
      // A dropped connection is by far the likeliest cause, and it is the one
      // thing the person can actually do something about.
      setCreateError(t("errors.offline"));
    } finally {
      setCreating(false);
    }
  }

  function join(event: React.FormEvent) {
    event.preventDefault();
    setJoinError(null);

    // Accepts a pasted invitation URL as readily as a typed code.
    const code = normalizeRoomCode(joinInput);
    if (!code) {
      setJoinError(t("errors.badCode"));
      return;
    }

    router.push(`/${code}`);
  }

  return (
    <section
      aria-labelledby="room-launcher-title"
      data-testid="room-launcher"
      className="grid gap-6 rounded-lg border border-border bg-surface p-5 sm:p-8"
    >
      <h2 id="room-launcher-title" className="sr-only">
        {t("title")}
      </h2>

      <div>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <h3 className="text-lg font-medium">{t("newMeeting")}</h3>
            <p className="mt-1 text-sm text-muted">{t("newMeetingHint")}</p>
          </div>
          <Button
            size="lg"
            onClick={createRoom}
            disabled={creating}
            className="w-full sm:w-auto"
          >
            {creating ? t("starting") : t("start")}
          </Button>
        </div>

        {/* The message stays with the action that can fix it: clicking the
            same Start button retries a failed create request. */}
        {createError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {createError}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span>{t("or")}</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <form
        onSubmit={join}
        aria-labelledby="room-launcher-join-title"
        className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
      >
        <div className="min-w-0">
          <h3 id="room-launcher-join-title" className="text-lg font-medium">
            {t("joinHeading")}
          </h3>
          <p className="mt-1 text-sm text-muted">{t("joinHint")}</p>
          <label htmlFor="join-code" className="mb-2 mt-4 block text-sm">
            {t("joinLabel")}
          </label>
          <Input
            id="join-code"
            name="code"
            // A room code is Latin regardless of interface language, so the
            // field stays LTR even in Arabic. Typing into an RTL field would
            // put the caret on the wrong side of what is being typed.
            dir="ltr"
            className="font-mono"
            value={joinInput}
            onChange={(event) => {
              setJoinInput(event.target.value);
              if (joinError) setJoinError(null);
            }}
            placeholder={t("joinPlaceholder")}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={joinError ? true : undefined}
            aria-describedby={joinError ? "launcher-join-error" : undefined}
          />
        </div>

        <Button
          type="submit"
          variant="secondary"
          size="lg"
          disabled={!joinInput.trim()}
          className="w-full sm:w-auto"
        >
          {t("join")}
        </Button>

        {joinError && (
          <p id="launcher-join-error" role="alert" className="text-sm text-danger sm:col-span-2">
            {joinError}
          </p>
        )}
      </form>
    </section>
  );
}
