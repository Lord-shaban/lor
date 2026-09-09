"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { useRoomContext } from "@livekit/components-react";
import * as Y from "yjs";
import {
  CanvasSnapshotWriter,
  hydrateCanvasSnapshot,
  type CanvasSnapshotStatus,
} from "@/lib/canvas-snapshot";
import {
  YjsLiveKitProvider,
  type YjsLiveKitRoom,
} from "@/lib/yjs-livekit";

const CanvasDocumentContext = createContext<Y.Doc | null>(null);

/** The hydrated call document, shared by the board without another transport. */
export function useCanvasDocument() {
  return useContext(CanvasDocumentContext);
}

function CanvasPersistenceNotice({
  status,
  deleting,
  onDelete,
}: {
  status: CanvasSnapshotStatus;
  deleting: boolean;
  onDelete: () => void;
}) {
  const t = useTranslations("call.canvas");
  if (status.kind === "loading" || status.kind === "empty") return null;

  const isFailure =
    status.kind === "malformed" ||
    status.kind === "unavailable" ||
    status.kind === "save_failed" ||
    status.kind === "too_large";
  const canDelete = status.kind === "restored" || status.kind === "saved";

  let copy: string;
  switch (status.kind) {
    case "restored":
    case "saved":
      copy = t("retention", { days: status.retentionDays });
      break;
    case "expired":
      copy = t("expired", { days: status.retentionDays });
      break;
    case "malformed":
      copy = t("malformed");
      break;
    case "unavailable":
      copy = t("unavailable");
      break;
    case "save_failed":
      copy = t("saveFailed");
      break;
    case "too_large":
      copy = t("tooLarge");
      break;
    case "deleted":
      copy = t("deleted");
      break;
    default:
      return null;
  }

  return (
    <aside
      role={isFailure ? "alert" : "status"}
      className={
        isFailure
          ? "flex flex-wrap items-center justify-center gap-x-3 gap-y-2 bg-[#7f1d1d] px-4 py-2 text-center text-sm text-[#fef2f2]"
          : "flex flex-wrap items-center justify-center gap-x-3 gap-y-2 bg-[#1e1e21] px-4 py-2 text-center text-sm text-[#d4d4d8]"
      }
    >
      <p className="max-w-3xl leading-relaxed">{copy}</p>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="min-h-11 rounded-md px-3 text-sm font-medium text-[#fca5a5] underline decoration-[#991b1b] underline-offset-4 hover:text-[#fee2e2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fca5a5] disabled:opacity-50"
        >
          {deleting ? t("deleting") : t("delete")}
        </button>
      )}
    </aside>
  );
}

/**
 * The one shared Canvas document for one call.
 *
 * The snapshot is applied before the LiveKit provider exists, so the provider's
 * first state-vector request describes the durable document. A connected peer
 * can then contribute newer operations normally; Yjs merges them rather than
 * treating storage as an authority over the live call.
 */
export function YjsRoomLifecycle({
  roomKey,
  children,
}: {
  roomKey: string;
  children: ReactNode;
}) {
  const room = useRoomContext();
  const [status, setStatus] = useState<CanvasSnapshotStatus>({
    kind: "loading",
    retentionDays: 30,
    version: 0,
  });
  const [deleting, setDeleting] = useState(false);
  const [canvasDocument, setCanvasDocument] = useState<Y.Doc | null>(null);
  const writerRef = useRef<CanvasSnapshotWriter | null>(null);
  const endpoint = `/api/rooms/${roomKey}/canvas`;

  useEffect(() => {
    let cancelled = false;
    let document: Y.Doc | undefined;
    let provider: YjsLiveKitProvider | undefined;

    // A timer avoids a synchronous state write while React is committing the
    // call. More importantly, it makes the intentional async boundary visible:
    // no Yjs provider is constructed until durable hydration has finished.
    const timer = setTimeout(() => {
      document = new Y.Doc();
      void (async () => {
        const initial = await hydrateCanvasSnapshot(document!, endpoint);
        // Hydration is intentionally asynchronous. If the caller leaves while
        // it is in flight, no component owns this document any more, so tear it
        // down here instead of waiting for a cleanup that has already run.
        if (cancelled) {
          document?.destroy();
          return;
        }

        setStatus(initial);
        setCanvasDocument(document);
        provider = new YjsLiveKitProvider({
          room: room as unknown as YjsLiveKitRoom,
          document: document!,
          roomKey,
        });
        writerRef.current = new CanvasSnapshotWriter({
          document: document!,
          endpoint,
          version: initial.version,
          retentionDays: initial.retentionDays,
          onStatus: setStatus,
        });

        // This follows hydration, never precedes it. Existing peers answer
        // with their newer diff if a save raced with the current meeting.
        void provider.requestSync();
      })();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      writerRef.current?.stop();
      writerRef.current = null;
      provider?.destroy();
      document?.destroy();
    };
  }, [endpoint, room, roomKey]);

  async function deleteSnapshot() {
    setDeleting(true);
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) {
        setStatus((current) => ({ ...current, kind: "save_failed" }));
        return;
      }

      // This removes the durable document shared by board and notes. The
      // current LiveKit session stays live; a later edit may deliberately make
      // a new snapshot, rather than this control pretending to erase a peer's
      // in-memory document from a serverless route.
      writerRef.current?.stop();
      setStatus((current) => ({
        kind: "deleted",
        retentionDays: current.retentionDays,
        version: 0,
      }));
    } catch {
      setStatus((current) => ({ ...current, kind: "save_failed" }));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <CanvasDocumentContext.Provider value={canvasDocument}>
      <CanvasPersistenceNotice
        status={status}
        deleting={deleting}
        onDelete={deleteSnapshot}
      />
      {children}
    </CanvasDocumentContext.Provider>
  );
}
