"use client";

import { useCallback, useRef, useState } from "react";
import { createTLStore, Tldraw } from "tldraw";
import * as Y from "yjs";
import "tldraw/tldraw.css";
import { bindTldrawToYjs } from "@/lib/tldraw-yjs";

/**
 * The heavy editor is intentionally isolated in this file. Its parent loads
 * this module dynamically only after someone opens the whiteboard.
 */
export function WhiteboardEditor({
  document,
  locale,
}: {
  document: Y.Doc;
  locale: "ar" | "en";
}) {
  const [store] = useState(() => createTLStore());
  const bindingRef = useRef<ReturnType<typeof bindTldrawToYjs> | null>(null);

  const onMount = useCallback(
    () => {
      bindingRef.current?.destroy();
      bindingRef.current = bindTldrawToYjs({ document, store });

      return () => {
        bindingRef.current?.destroy();
        bindingRef.current = null;
      };
    },
    [document, store],
  );

  return (
    <Tldraw
      store={store}
      locale={locale}
      onMount={onMount}
      className="h-full w-full"
    />
  );
}
