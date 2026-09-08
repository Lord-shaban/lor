import type { TLRecord, TLStore } from "tldraw";
import * as Y from "yjs";

/**
 * The board is a small CRDT inside the call's one Yjs document. Keeping the
 * tldraw records as individual map entries means a late joiner can rebuild a
 * store from the durable Yjs state, while Yjs still carries only the records
 * that changed over LiveKit.
 */
export const TLDRAW_RECORDS_KEY = "tldraw-records";

type TldrawChanges = {
  added: Record<string, TLRecord>;
  removed: Record<string, TLRecord>;
  updated: Record<string, [TLRecord, TLRecord]>;
};

type PendingRecord = TLRecord | null;

function cameraOnly(changes: TldrawChanges): TldrawChanges {
  const isCamera = (record: TLRecord) => record.typeName === "camera";

  return {
    added: Object.fromEntries(
      Object.entries(changes.added).filter(([, record]) => isCamera(record)),
    ),
    removed: Object.fromEntries(
      Object.entries(changes.removed).filter(([, record]) => isCamera(record)),
    ),
    updated: Object.fromEntries(
      Object.entries(changes.updated).filter(([, [, record]]) => isCamera(record)),
    ),
  };
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
}: {
  document: Y.Doc;
  store: TLStore;
}) {
  const records = document.getMap<TLRecord>(TLDRAW_RECORDS_KEY);
  const pending = new Map<string, PendingRecord>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (pending.size === 0) return;

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
      pending.set(record.id, record);
    }
    for (const [, record] of Object.values(changes.updated)) {
      pending.set(record.id, record);
    }
    for (const record of Object.values(changes.removed)) {
      pending.set(record.id, null);
    }
    if (pending.size > 0) scheduleFlush();
  }

  function applyRecords(ids: Iterable<string>) {
    const additions: TLRecord[] = [];
    const removals: TLRecord["id"][] = [];

    for (const id of ids) {
      const record = records.get(id);
      if (record) {
        additions.push(structuredClone(record));
      } else if (store.has(id as TLRecord["id"])) {
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

  const stopDocumentListener = store.listen(
    ({ changes }) => queue(changes),
    { source: "user", scope: "document" },
  );
  const stopCameraListener = store.listen(
    ({ changes }) => queue(cameraOnly(changes)),
    { source: "user", scope: "session" },
  );

  return {
    flush,
    destroy() {
      flush();
      stopDocumentListener();
      stopCameraListener();
      records.unobserve(onRecordsChanged);
    },
  };
}
