import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { BinaryFileData, BinaryFiles } from "@excalidraw/excalidraw/types";
import * as Y from "yjs";

export const BOARD_ELEMENTS_KEY = "excalidraw-elements";
export const BOARD_FILES_KEY = "excalidraw-files";

export function readBoard(document: Y.Doc) {
  return {
    elements: Array.from(document.getMap<ExcalidrawElement>(BOARD_ELEMENTS_KEY).values()),
    files: Object.fromEntries(document.getMap<BinaryFileData>(BOARD_FILES_KEY)) as BinaryFiles,
  };
}

/** Only changed document elements cross LiveKit; camera/selection stay local. */
export function bindExcalidrawToYjs(
  document: Y.Doc,
  apply: (scene: ReturnType<typeof readBoard>) => void,
) {
  const elements = document.getMap<ExcalidrawElement>(BOARD_ELEMENTS_KEY);
  const files = document.getMap<BinaryFileData>(BOARD_FILES_KEY);
  const origin = {};
  const seen = new Map<string, string>();
  const pending = new Map<string, ExcalidrawElement>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  for (const element of elements.values()) seen.set(element.id, JSON.stringify(element));

  function flush() {
    clearTimeout(timer);
    timer = undefined;
    if (!pending.size) return;
    document.transact(() => {
      for (const [id, element] of pending) elements.set(id, structuredClone(element));
    }, origin);
    pending.clear();
  }

  function receive(_event: unknown, transaction: Y.Transaction) {
    if (transaction.origin === origin) return;
    // HTTP conflict restores are local Yjs transactions too. Flush pending
    // gestures before merging so an incoming edit cannot erase an unsent one.
    flush();
    const scene = readBoard(document);
    for (const element of scene.elements) seen.set(element.id, JSON.stringify(element));
    apply(scene);
  }
  elements.observe(receive);
  files.observe(receive);

  return {
    onChange(scene: readonly ExcalidrawElement[], binaryFiles: BinaryFiles) {
      if (disposed) return;
      for (const element of scene) {
        const signature = JSON.stringify(element);
        if (seen.get(element.id) === signature) continue;
        seen.set(element.id, signature);
        // Deleted elements are tombstones, so erasing and undo both sync.
        pending.set(element.id, structuredClone(element));
      }
      document.transact(() => {
        for (const file of Object.values(binaryFiles)) {
          if (files.get(file.id)?.dataURL !== file.dataURL) {
            files.set(file.id, structuredClone(file));
          }
        }
      }, origin);
      if (pending.size && !timer) timer = setTimeout(flush, 48);
    },
    flush,
    destroy() {
      disposed = true;
      flush();
      elements.unobserve(receive);
      files.unobserve(receive);
    },
  };
}
