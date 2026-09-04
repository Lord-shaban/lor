"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { JoinDetails } from "@/components/prejoin/prejoin";
import { WaitingRoom } from "@/components/prejoin/waiting-room";
import { CallRoom, type Connection } from "@/components/call/call-room";
import { CopyLink } from "@/components/copy-link";
import { pollDelay, waitingState, type WaitingState } from "@/lib/waiting";

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

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    const value = randomId();
    sessionStorage.setItem(SESSION_KEY, value);
    return value;
  } catch {
    // Storage can be unavailable. A fresh id still works for this page load;
    // it just means a reload joins as a new participant.
    return randomId();
  }
}

interface Waiting {
  /** Null when there is nothing left to poll — a refusal, which is final. */
  claim: string | null;
  details: JoinDetails;
}

/**
 * Everything between opening a room link and being in the call.
 *
 * The token is requested only when someone presses Join, not on page load: a
 * link that is opened and abandoned should not mint credentials, and the server
 * decides publish rights from the room's state at that moment rather than
 * whenever the tab happened to load.
 *
 * When the room has a door, pressing Join knocks first. Every decision about
 * who gets in is the server's; this only ever reports what it was told.
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

  // Held apart from `state` so that updating what the screen says does not
  // restart the poll — which would reset the clock the backoff is measured from
  // and keep it at its fastest for as long as somebody is waiting.
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [state, setState] = useState<Exclude<WaitingState, "admitted">>(
    "waiting",
  );

  async function requestToken(joinDetails: JoinDetails): Promise<boolean> {
    const response = await fetch(`/api/rooms/${code}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: joinDetails.name, sessionId: sessionId() }),
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
      return false;
    }

    setDetails(joinDetails);
    setConnection((await response.json()) as Connection);
    return true;
  }

  async function join(joinDetails: JoinDetails) {
    setJoining(true);
    setError(null);

    try {
      const response = await fetch(`/api/rooms/${code}/knock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinDetails.name, sessionId: sessionId() }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
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

      const { outcome, claim } = await response.json();

      switch (outcome) {
        // No door on this room, or one already opened for this person.
        case "open":
        case "admitted":
          await requestToken(joinDetails);
          return;

        case "denied":
          setState("denied");
          setWaiting({ claim: null, details: joinDetails });
          return;

        // "created" or "waiting": the host has been asked and has not answered.
        default:
          setState("waiting");
          setWaiting({
            claim: typeof claim === "string" ? claim : null,
            details: joinDetails,
          });
          return;
      }
    } catch {
      setError(t("errors.offline"));
    } finally {
      setJoining(false);
    }
  }

  // Poll until the host answers. Restarts only when a new knock is made, so the
  // backoff measures the real wait rather than the time since the last render.
  useEffect(() => {
    // Pinned into explicitly typed constants: `ask` below is a hoisted function
    // declaration, and TypeScript will not carry a narrowing across one.
    if (!waiting?.claim) return;
    const claim: string = waiting.claim;
    const joinDetails: JoinDetails = waiting.details;

    const startedAt = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function ask() {
      if (cancelled) return;

      try {
        const response = await fetch(`/api/rooms/${code}/knock/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionId(), claim }),
        });

        if (response.ok) {
          const body = await response.json();
          const next = waitingState({
            status: body.status,
            hostPresent: body.hostPresent ?? null,
          });

          if (cancelled) return;

          if (next === "admitted") {
            setWaiting(null);
            await requestToken(joinDetails);
            return;
          }

          setState(next);
          // A refusal is final, so there is nothing left to ask about.
          if (next === "denied") return;
        }
      } catch {
        // Offline, or a request that failed on the way. Keep asking: the wait
        // is the one place where giving up quietly is the worst thing to do.
      }

      if (!cancelled) {
        timer = setTimeout(ask, pollDelay(Date.now() - startedAt));
      }
    }

    timer = setTimeout(ask, pollDelay(0));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // requestToken closes over setters only, all of which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, code]);

  if (connection && details) {
    return (
      <CallRoom
        code={code}
        connection={connection}
        details={details}
        onLeave={() => {
          // Back to the prejoin rather than to a dead end, so rejoining is one
          // press away — which is what people do after an accidental leave or a
          // connection that gave up.
          setConnection(null);
          setDetails(null);
        }}
      />
    );
  }

  // The prejoin brings its own page chrome; the call deliberately has none.
  return (
    <main className="flex flex-1 justify-center px-6 py-12">
      <div className="w-full max-w-4xl">
        <h1 className="text-xl font-semibold tracking-tight">{t("getReady")}</h1>
        <p className="mt-2 text-base text-muted">{t("checkBeforeJoining")}</p>

        <div className="mt-8">
          {waiting ? (
            <WaitingRoom
              state={state}
              name={waiting.details.name}
              onCancel={() => setWaiting(null)}
            />
          ) : (
            <Prejoin onJoin={join} joining={joining} joinError={error} />
          )}
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="mb-3 text-sm text-muted">{t("shareToInvite")}</p>
          <CopyLink url={inviteUrl} />
        </div>
      </div>
    </main>
  );
}
