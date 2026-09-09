import { afterEach, describe, expect, it } from "vitest";
import type { TLRecord, TLStore } from "tldraw";
import * as Y from "yjs";
import { bindTldrawToYjs, TLDRAW_RECORDS_KEY } from "./tldraw-yjs";

type Scope = "document" | "session";
type Changes = {
  added: Record<string, TLRecord>;
  removed: Record<string, TLRecord>;
  updated: Record<string, [TLRecord, TLRecord]>;
};

class FakeStore {
  readonly records = new Map<string, TLRecord>();
  remoteMerges = 0;
  private readonly listeners: Array<{
    callback: (entry: { changes: Changes }) => void;
    scope: Scope;
  }> = [];

  has(id: string) {
    return this.records.has(id);
  }

  put(records: TLRecord[]) {
    for (const record of records) this.records.set(record.id, record);
  }

  remove(ids: string[]) {
    for (const id of ids) this.records.delete(id);
  }

  mergeRemoteChanges(callback: () => void) {
    this.remoteMerges += 1;
    callback();
  }

  listen(
    callback: (entry: { changes: Changes }) => void,
    options: { scope: Scope },
  ) {
    const listener = { callback, scope: options.scope };
    this.listeners.push(listener);
    return () => {
      this.listeners.splice(this.listeners.indexOf(listener), 1);
    };
  }

  userChange(scope: Scope, changes: Changes) {
    for (const record of Object.values(changes.added)) this.records.set(record.id, record);
    for (const [, record] of Object.values(changes.updated)) {
      this.records.set(record.id, record);
    }
    for (const record of Object.values(changes.removed)) this.records.delete(record.id);

    for (const listener of this.listeners) {
      if (listener.scope === scope) listener.callback({ changes });
    }
  }
}

const bindings: Array<ReturnType<typeof bindTldrawToYjs>> = [];

function record(id: string, typeName = "shape"): TLRecord {
  return { id, typeName, x: 0, y: 0, z: 1, meta: {} } as unknown as TLRecord;
}

function emptyChanges(): Changes {
  return { added: {}, removed: {}, updated: {} };
}

function bind(document: Y.Doc, store: FakeStore) {
  const binding = bindTldrawToYjs({
    document,
    store: store as unknown as TLStore,
  });
  bindings.push(binding);
  return binding;
}

function copy(source: Y.Doc, destination: Y.Doc) {
  Y.applyUpdate(destination, Y.encodeStateAsUpdate(source));
}

afterEach(() => {
  for (const binding of bindings.splice(0)) binding.destroy();
});

describe("tldraw records over the shared Yjs document", () => {
  it("syncs drawing records to another open board and keeps remote work out of undo history", () => {
    const firstDocument = new Y.Doc();
    const secondDocument = new Y.Doc();
    const first = new FakeStore();
    const second = new FakeStore();
    const firstBinding = bind(firstDocument, first);
    bind(secondDocument, second);

    const shape = record("shape:arabic-notes");
    first.userChange("document", {
      ...emptyChanges(),
      added: { [shape.id]: shape },
    });
    firstBinding.flush();
    copy(firstDocument, secondDocument);

    expect(second.records.get(shape.id)).toEqual(shape);
    expect(second.remoteMerges).toBe(1);
    expect(secondDocument.getMap(TLDRAW_RECORDS_KEY).get(shape.id)).toEqual(shape);
  });

  it("rebuilds a late joiner's board, including erase and undo updates", () => {
    const sourceDocument = new Y.Doc();
    const source = new FakeStore();
    const sourceBinding = bind(sourceDocument, source);
    const firstShape = record("shape:one");
    const revisedShape = { ...firstShape, x: 160 } as TLRecord;

    source.userChange("document", {
      ...emptyChanges(),
      added: { [firstShape.id]: firstShape },
    });
    sourceBinding.flush();
    source.userChange("document", {
      ...emptyChanges(),
      updated: { [firstShape.id]: [firstShape, revisedShape] },
    });
    sourceBinding.flush();

    const lateDocument = new Y.Doc();
    copy(sourceDocument, lateDocument);
    const late = new FakeStore();
    bind(lateDocument, late);
    expect(late.records.get(firstShape.id)).toEqual(revisedShape);

    // A tldraw undo emits an ordinary user-side record update; it follows the
    // same path as a new stroke and is therefore visible to a later joiner.
    source.userChange("document", {
      ...emptyChanges(),
      updated: { [firstShape.id]: [revisedShape, firstShape] },
    });
    sourceBinding.flush();
    copy(sourceDocument, lateDocument);
    expect(late.records.get(firstShape.id)).toEqual(firstShape);

    source.userChange("document", {
      ...emptyChanges(),
      removed: { [firstShape.id]: firstShape },
    });
    sourceBinding.flush();
    copy(sourceDocument, lateDocument);
    expect(late.records.has(firstShape.id)).toBe(false);
  });

  it("does not persist camera, selection, or other session state", () => {
    const firstDocument = new Y.Doc();
    const secondDocument = new Y.Doc();
    const first = new FakeStore();
    const second = new FakeStore();
    const firstBinding = bind(firstDocument, first);
    bind(secondDocument, second);

    const camera = {
      ...record("camera:page", "camera"),
      x: 240,
      y: -120,
      z: 1.5,
    } as TLRecord;
    const selection = record("instance:local", "instance");
    first.userChange("session", {
      ...emptyChanges(),
      added: { [camera.id]: camera, [selection.id]: selection },
    });
    firstBinding.flush();
    copy(firstDocument, secondDocument);

    const firstRecords = firstDocument.getMap(TLDRAW_RECORDS_KEY);
    expect(firstRecords.has(camera.id)).toBe(false);
    expect(firstRecords.has(selection.id)).toBe(false);
    expect(second.records.has(camera.id)).toBe(false);
    expect(second.records.has(selection.id)).toBe(false);
  });

  it("ignores session records saved by the earlier board version", () => {
    const document = new Y.Doc();
    const store = new FakeStore();
    const legacyCamera = {
      ...record("camera:page", "camera"),
      x: 120,
      y: -80,
      z: 1.25,
    } as TLRecord;
    const legacySelection = record("instance:legacy", "instance");

    document.getMap(TLDRAW_RECORDS_KEY).set(legacyCamera.id, legacyCamera);
    document.getMap(TLDRAW_RECORDS_KEY).set(legacySelection.id, legacySelection);
    bind(document, store);

    expect(store.records.has(legacyCamera.id)).toBe(false);
    expect(store.records.has(legacySelection.id)).toBe(false);
  });
});
