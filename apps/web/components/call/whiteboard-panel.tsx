"use client";

import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useCanvasDocument } from "@/components/call/use-yjs-room";

const WhiteboardEditor = dynamic(
  () => {
    // Excalidraw reads this as its module loads. The build copies its fonts
    // under public/excalidraw so the board never depends on a third-party CDN.
    if (typeof window !== "undefined") {
      (window as Window & { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = "/excalidraw/";
    }
    return import("@/components/call/whiteboard-editor").then(
      ({ WhiteboardEditor: Editor }) => Editor,
    );
  },
  {
    ssr: false,
    loading: () => <WhiteboardLoading />,
  },
);

function WhiteboardLoading() {
  const t = useTranslations("call.whiteboard");
  return (
    <div
      role="status"
      className="grid h-full place-items-center bg-[#111113] px-6 text-center text-sm text-[#d4d4d8]"
    >
      {t("loading")}
    </div>
  );
}

/** A focused workspace over the call stage, not a second call surface. */
export function WhiteboardPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("call.whiteboard");
  const locale = useLocale();
  const document = useCanvasDocument();

  return (
    <section
      aria-labelledby="whiteboard-title"
      className="absolute inset-0 z-30 flex min-h-0 flex-col bg-[#111113]"
    >
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#2a2a2e] bg-[#141416] px-3 sm:px-4">
        <div className="min-w-0">
          <h2 id="whiteboard-title" className="truncate text-sm font-semibold text-[#f4f4f5]">
            {t("title")}
          </h2>
          <p className="truncate text-xs text-[#a1a1aa]">{t("live")}</p>
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
        {document ? (
          <WhiteboardEditor
            document={document}
            locale={locale === "ar" ? "ar" : "en"}
          />
        ) : (
          <WhiteboardLoading />
        )}
      </div>
    </section>
  );
}
