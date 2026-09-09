import { afterEach, expect, it, vi } from "vitest";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import * as Y from "yjs";
import { bindExcalidrawToYjs, readBoard } from "./excalidraw-yjs";

const element = (id: string, version = 1, isDeleted = false) =>
  ({ id, version, versionNonce: version, type: "rectangle", isDeleted, x: 0, y: 0 }) as ExcalidrawElement;
afterEach(() => vi.useRealTimers());

it("merges concurrent strokes, shares erase/undo, and restores a late opener", () => {
  const a = new Y.Doc();
  const b = new Y.Doc();
  const aa = bindExcalidrawToYjs(a, vi.fn());
  const apply = vi.fn();
  const bb = bindExcalidrawToYjs(b, apply);
  aa.onChange([element("a")], {});
  bb.onChange([element("b")], {});
  aa.flush(); bb.flush();
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  expect(readBoard(b).elements.map(e => e.id).sort()).toEqual(["a", "b"]);
  aa.onChange([element("a", 2, true), element("b")], {}); aa.flush();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  expect(readBoard(b).elements.find(e => e.id === "a")?.isDeleted).toBe(true);
  aa.onChange([element("a", 3), element("b")], {}); aa.flush();
  const late = new Y.Doc();
  Y.applyUpdate(late, Y.encodeStateAsUpdate(a));
  expect(readBoard(late).elements.filter(e => !e.isDeleted)).toHaveLength(2);
  expect(apply).toHaveBeenCalled();
  aa.destroy(); bb.destroy();
});

it("does not echo remote renders or send updates for camera-only callbacks", () => {
  vi.useFakeTimers();
  const a = new Y.Doc();
  const b = new Y.Doc();
  const aa = bindExcalidrawToYjs(a, vi.fn());
  const bb = bindExcalidrawToYjs(b, scene => bb.onChange(scene.elements, scene.files));
  aa.onChange([element("a")], {}); aa.flush();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  const update = vi.fn(); b.on("update", update);
  bb.onChange(readBoard(b).elements, {});
  vi.advanceTimersByTime(1_000);
  expect(update).not.toHaveBeenCalled();
  aa.destroy(); bb.destroy();
});

it("applies same-browser HTTP conflict hydration and flushes on close", () => {
  const doc = new Y.Doc();
  const apply = vi.fn();
  const binding = bindExcalidrawToYjs(doc, apply);
  doc.getMap("excalidraw-elements").set("restored", element("restored"));
  expect(apply).toHaveBeenCalled();
  binding.onChange([...readBoard(doc).elements, element("pending")], {});
  binding.destroy();
  expect(readBoard(doc).elements).toHaveLength(2);
  apply.mockClear();
  doc.getMap("excalidraw-elements").set("later", element("later"));
  expect(apply).not.toHaveBeenCalled();
});
