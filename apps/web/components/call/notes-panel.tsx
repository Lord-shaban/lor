"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCanvasDocument } from "@/components/call/use-yjs-room";

const NotesEditor = dynamic(
  () => import("@/components/call/notes-editor").then(({ NotesEditor: Editor }) => Editor),
  { ssr: false, loading: () => <NotesLoading /> },
);

function NotesLoading() {
  const t = useTranslations("call.notes");
  return (
    <div
      role="status"
      className="grid h-full place-items-center bg-[#111113] px-6 text-center text-sm text-[#d4d4d8]"
    >
      {t("loading")}
    </div>
  );
}

/** A quiet writing workspace over the call stage, backed by the shared Canvas. */
export function NotesPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("call.notes");
  const document = useCanvasDocument();

  return (
    <section
      aria-labelledby="notes-title"
      className="absolute inset-0 z-30 flex min-h-0 flex-col bg-[#111113]"
      data-testid="shared-notes"
    >
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#2a2a2e] bg-[#141416] px-3 sm:px-4">
        <div className="min-w-0">
          <h2 id="notes-title" className="truncate text-sm font-semibold text-[#f4f4f5]">
            {t("title")}
          </h2>
          <p id="notes-collaboration-status" role="status" className="truncate text-xs text-[#a1a1aa]">
            {t("live")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-11 shrink-0 rounded-md bg-[#1e1e21] px-4 text-sm font-medium text-[#f4f4f5] transition-colors duration-150 hover:bg-[#2a2a2e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5]"
        >
          {t("close")}
        </button>
      </header>

      <div className="min-h-0 flex-1">
        {document ? <NotesEditor document={document} /> : <NotesLoading />}
      </div>
    </section>
  );
}
