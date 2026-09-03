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
 * Starting is the primary action and takes one click; the join field is
 * secondary because most people arrive by opening a link, not by typing a code.
 */
export function RoomLauncher() {
  const t = useTranslations("launcher");
  const locale = useLocale();
  const router = useRouter();

  const [creating, setCreating] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });

      if (response.status === 429) {
        setError(t("errors.tooMany"));
        return;
      }
      if (!response.ok) {
        setError(t("errors.createFailed"));
        return;
      }

      const { code } = (await response.json()) as { code: string };
      router.push(`/${code}`);
    } catch {
      // A dropped connection is by far the likeliest cause, and it is the one
      // thing the person can actually do something about.
      setError(t("errors.offline"));
    } finally {
      setCreating(false);
    }
  }

  function join(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    // Accepts a pasted invitation URL as readily as a typed code.
    const code = normalizeRoomCode(joinInput);
    if (!code) {
      setError(t("errors.badCode"));
      return;
    }

    router.push(`/${code}`);
  }

  return (
    <div className="mt-10">
      <Button size="lg" onClick={createRoom} disabled={creating}>
        {creating ? t("starting") : t("start")}
      </Button>

      <form onSubmit={join} className="mt-6 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="join-code" className="mb-2 block text-sm text-muted">
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
              if (error) setError(null);
            }}
            placeholder={t("joinPlaceholder")}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "launcher-error" : undefined}
          />
        </div>

        <Button
          type="submit"
          variant="secondary"
          size="lg"
          className="mt-[1.875rem]"
          disabled={!joinInput.trim()}
        >
          {t("join")}
        </Button>
      </form>

      {/* Announced when it appears, and sitting next to the field it refers to
          rather than in a banner somewhere above. */}
      {error && (
        <p
          id="launcher-error"
          role="alert"
          className="mt-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}
