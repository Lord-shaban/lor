"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CaptureUpdateAction, Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import * as Y from "yjs";
import "@excalidraw/excalidraw/index.css";
import { bindExcalidrawToYjs, readBoard } from "@/lib/excalidraw-yjs";

/** Loaded only when the board opens. No licence service or separate socket. */
export function WhiteboardEditor({ document, locale }: {
  document: Y.Doc;
  locale: "ar" | "en";
}) {
  const t = useTranslations("call.whiteboard");
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [initialData] = useState(() => ({
    ...readBoard(document),
    appState: { currentItemFontFamily: 2 },
    scrollToContent: true,
  }));
  const [legacy] = useState(() => document.getMap("tldraw-records").toJSON());

  useEffect(() => {
    if (!api) return;
    const apply = (scene: ReturnType<typeof readBoard>) => {
      api.addFiles(Object.values(scene.files));
      api.updateScene({ elements: scene.elements, captureUpdate: CaptureUpdateAction.NEVER });
    };
    const binding = bindExcalidrawToYjs(document, apply);
    // Include updates received while the lazy editor was mounting.
    apply(readBoard(document));
    const unsubscribe = api.onChange((elements, _state, files) => binding.onChange(elements, files));
    return () => { unsubscribe(); binding.destroy(); };
  }, [api, document]);

  function downloadLegacy() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(legacy, null, 2)], { type: "application/json" }));
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "lor-previous-whiteboard.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="shared-whiteboard">
      {Object.keys(legacy).length > 0 && (
        <aside role="status" className="flex shrink-0 flex-wrap items-center justify-center gap-2 bg-[#1e1e21] px-3 py-2 text-sm text-[#d4d4d8]">
          <p>{t("legacyNotice")}</p>
          <button type="button" className="min-h-11 px-3 underline focus-visible:outline-2" onClick={downloadLegacy}>{t("legacyDownload")}</button>
        </aside>
      )}
      <div className="min-h-0 flex-1" dir={locale === "ar" ? "rtl" : "ltr"}>
        <Excalidraw
          excalidrawAPI={setApi}
          initialData={initialData}
          langCode={locale === "ar" ? "ar-SA" : "en"}
          theme="dark"
          isCollaborating
          autoFocus
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false } }}
        >
          <MainMenu>
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.Help />
          </MainMenu>
        </Excalidraw>
      </div>
    </div>
  );
}
