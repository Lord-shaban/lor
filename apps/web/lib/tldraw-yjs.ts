import type { Editor, TLCamera, TLRecord, TLStore } from "tldraw";
import * as Y from "yjs";

/**
 * The board is a small CRDT inside the call's one Yjs document. Keeping the
 * tldraw records as individual map entries means a late joiner can rebuild a
 * store from the durable Yjs state, while Yjs still carries only the records
 * that changed over LiveKit.
 */
export const TLDRAW_RECORDS_KEY = "tldraw-records";
export const TLDRAW_CAMERA_KEY = "tldraw-camera";

type TldrawChanges = {
  added: Record<string, TLRecord>;
  removed: Record<string, TLRecord>;
  updated: Record<string, [TLRecord, TLRecord]>;
};

type PendingRecord = TLRecord | null;
type SharedCamera = Pick<TLCamera, "x" | "y" | "z">;

function isCamera(record: TLRecord): record is TLCamera {
  return record.typeName === "camera";
}

function cameraFrom(changes: TldrawChanges): SharedCamera | undefined {
  const records = [
    ...Object.values(changes.added),
    ...Object.values(changes.updated).map(([, record]) => record),
  ];
  const camera = records.find(isCamera);
  return camera ? { x: camera.x, y: camera.y, z: camera.z } : undefined;
}

function sameCamera(left: SharedCamera, right: SharedCamera) {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

function isSharedCamera(value: unknown): value is SharedCamera {
  if (!value || typeof value !== "object") return false;
  const camera = value as Partial<SharedCamera>;
  return (
    typeof camera.x === "number" &&
    Number.isFinite(camera.x) &&
    typeof camera.y === "number" &&
    Number.isFinite(camera.y) &&
    typeof camera.z === "number" &&
    Number.isFinite(camera.z)
  );
}

/**
 * Attach a tldraw store to the call document.
 *
 * tldraw deliberately distinguishes locally-authored and remotely-merged
 * records. The latter distinction is important here: incoming Yjs changes are
 * marked remote, so they neither echo back through LiveKit nor enter a
 * participant's undo history.
 */
export function bindTldrawToYjs({
  document,
  store,
  editor,
}: {
  document: Y.Doc;
  store: TLStore;
  editor: Editor;
}) {
  const records = document.getMap<TLRecord>(TLDRAW_RECORDS_KEY);
  const sharedCamera = document.getMap<SharedCamera>(TLDRAW_CAMERA_KEY);
  const pending = new Map<string, PendingRecord>();
  let pendingCamera: SharedCamera | undefined;
  let lastRemoteCamera: SharedCamera | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (pending.size === 0 && !pendingCamera) return;

    document.transact(() => {
      for (const [id, record] of pending) {
        if (record) {
          // Store records are immutable JSON-shaped values. Cloning prevents
          // either library from retaining a mutable reference owned by the
          // other while keeping tldraw's schema data intact.
          records.set(id, structuredClone(record));
        } else {
          records.delete(id);
        }
      }
      if (pendingCamera) {
        sharedCamera.set("viewport", pendingCamera);
        pendingCamera = undefined;
      }
    });
    pending.clear();
  }

  function scheduleFlush() {
    // Drawing and panning can produce a record for every pointer event. A
    // short batch keeps the reliable data channel responsive for captions and
    // chat too, without making a stroke feel delayed to another participant.
    if (!timer) timer = setTimeout(flush, 48);
  }

  function queue(changes: TldrawChanges) {
    for (const record of Object.values(changes.added)) {
      if (!isCamera(record)) pending.set(record.id, record);
    }
    for (const [, record] of Object.values(changes.updated)) {
      if (!isCamera(record)) pending.set(record.id, record);
    }
    for (const record of Object.values(changes.removed)) {
      if (!isCamera(record)) pending.set(record.id, null);
    }
    if (pending.size > 0) scheduleFlush();
  }

  function queueCamera(changes: TldrawChanges) {
    const camera = cameraFrom(changes);
    // Calling editor.setCamera for a remote viewport updates tldraw's session
    // record too. Do not turn that application into a second outbound update.
    if (!camera || (lastRemoteCamera && sameCamera(camera, lastRemoteCamera))) return;
    pendingCamera = camera;
    scheduleFlush();
  }

  function applyRecords(ids: Iterable<string>) {
    const additions: TLRecord[] = [];
    const removals: TLRecord["id"][] = [];

    for (const id of ids) {
      const record = records.get(id);
      // v0.1.8 initially stored camera records alongside document records.
      // They are session state, not a tldraw document record; applying one as
      // a remote store merge can blank the editor after the first pan.
      if (record && !isCamera(record)) {
        additions.push(structuredClone(record));
      } else if (!record && !id.startsWith("camera:") && store.has(id as TLRecord["id"])) {
        removals.push(id as TLRecord["id"]);
      }
    }

    if (additions.length === 0 && removals.length === 0) return;
    store.mergeRemoteChanges(() => {
      if (additions.length > 0) store.put(additions);
      if (removals.length > 0) store.remove(removals);
    });
  }

  // The document might have hydrated before the editor was opened. Populate it
  // before adding listeners so a restored board does not appear as a local edit.
  applyRecords(records.keys());

  const onRecordsChanged = (
    event: Y.YMapEvent<TLRecord>,
    transaction: Y.Transaction,
  ) => {
    if (transaction.local) return;
    applyRecords(event.keysChanged);
  };
  records.observe(onRecordsChanged);

  function applyRemoteCamera() {
    const camera = sharedCamera.get("viewport");
    if (!isSharedCamera(camera)) return;
    const current = editor.getCamera();
    if (sameCamera(current, camera)) return;

    lastRemoteCamera = camera;
    // Immediate avoids an animation fighting a local pointer drag. The visual
    // state changes once, while the editor itself remains mounted.
    editor.setCamera(camera, { immediate: true });
  }

  const onCameraChanged = (
    _event: Y.YMapEvent<SharedCamera>,
    transaction: Y.Transaction,
  ) => {
    if (!transaction.local) applyRemoteCamera();
  };
  sharedCamera.observe(onCameraChanged);
  applyRemoteCamera();

  const stopDocumentListener = store.listen(
    ({ changes }) => queue(changes),
    { source: "user", scope: "document" },
  );
  const stopCameraListener = store.listen(
    ({ changes }) => queueCamera(changes),
    { source: "user", scope: "session" },
  );

  return {
    flush,
    destroy() {
      flush();
      stopDocumentListener();
      stopCameraListener();
      records.unobserve(onRecordsChanged);
      sharedCamera.unobserve(onCameraChanged);
    },
  };
}
