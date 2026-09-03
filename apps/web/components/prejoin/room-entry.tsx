"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { JoinDetails } from "@/components/prejoin/prejoin";
import { CopyLink } from "@/components/copy-link";
import { LiveDot } from "@/components/ui/live-dot";

/**
 * The prejoin screen never renders on the server.
 *
 * It has nothing to show there — no devices, no stored preferences — and
 * rendering it twice would mean a first paint from defaults followed by a
 * visible correction once storage is read. Skipping SSR lets it read
 * preferences at initialisation and be right immediately.
 */
const Prejoin = dynamic(
  () => import("@/components/prejoin/prejoin").then((m) => m.Prejoin),
  { ssr: false },
);

/** Per tab, so a reload rejoins as the same participant and a second tab does not evict the first. */
const SESSION_KEY = "lor-session-id";

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const value = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    sessionStorage.setItem(SESSION_KEY, value);
    return value;
  } catch {
    // Storage can be unavailable. A fresh id still works for this page load;
    // it just means a reload joins as a new participant.
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

interface Connection {
  token: string;
  serverUrl: string;
  identity: string;
  canPublish: boolean;
  isHost: boolean;
}

/**
 * Everything between opening a room link and being in the call.
 *
 * The token is requested only when someone presses Join, not on page load: a
 * link that is opened and abandoned should not mint credentials, and the server
 * decides publish rights from the room's state at that moment rather than
 * whenever the tab happened to load.
 */
export function RoomEntry({
  code,
  inviteUrl,
}: {
  code: string;
  inviteUrl: string;
}) {
  const t = useTranslations("room");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [details, setDetails] = useState<JoinDetails | null>(null);

  async function join(joinDetails: JoinDetails) {
    setJoining(true);
    setError(null);

    try {
      const response = await fetch(`/api/rooms/${code}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: joinDetails.name,
          sessionId: sessionId(),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        // Each of these has a different answer for the person reading it, so
        // they get different messages rather than one generic failure.
        setError(
          body?.error === "room_locked"
            ? t("errors.locked")
            : body?.error === "rate_limited"
              ? t("errors.rateLimited")
              : response.status === 404
                ? t("errors.notFound")
                : t("errors.joinFailed"),
        );
        return;
      }

      setDetails(joinDetails);
      setConnection((await response.json()) as Connection);
    } catch {
      setError(t("errors.offline"));
    } finally {
      setJoining(false);
    }
  }

  if (connection && details) {
    return (
      <div>
        <LiveDot label={t("connected")} className="text-sm" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          {t("joinedAs", { name: details.name })}
        </h1>
        <p className="mt-2 text-base text-muted">
          {connection.canPublish ? t("canPublish") : t("waitingForHost")}
        </p>
        <p className="mt-6 text-sm text-muted">{t("videoComingSoon")}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">{t("getReady")}</h1>
      <p className="mt-2 text-base text-muted">{t("checkBeforeJoining")}</p>

      <div className="mt-8">
        <Prejoin onJoin={join} joining={joining} joinError={error} />
      </div>

      <div className="mt-10 border-t border-border pt-6">
        <p className="mb-3 text-sm text-muted">{t("shareToInvite")}</p>
        <CopyLink url={inviteUrl} />
      </div>
    </div>
  );
}
