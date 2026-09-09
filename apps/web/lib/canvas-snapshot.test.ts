import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  CANVAS_SNAPSHOT_THROTTLE_MS,
  CanvasSnapshotWriter,
  hydrateCanvasSnapshot,
  type CanvasSnapshotStatus,
} from "./canvas-snapshot";
import { CANVAS_SNAPSHOT_CONTENT_TYPE } from "./canvas-snapshot-protocol";

const endpoint = "/api/rooms/canvas-room/canvas";
const statuses: CanvasSnapshotStatus[] = [];
const writers: CanvasSnapshotWriter[] = [];

function snapshotResponse(update: Uint8Array, version: number, days = 30) {
  return new Response(new Uint8Array(update), {
    headers: {
      "Content-Type": `${CANVAS_SNAPSHOT_CONTENT_TYPE}; version=1`,
      ETag: `"${version}"`,
      "X-LOR-Canvas-Retention-Days": String(days),
    },
  });
}

function createWriter(document: Y.Doc, version = 0) {
  const writer = new CanvasSnapshotWriter({
    document,
    endpoint,
    version,
    retentionDays: 30,
    onStatus: (status) => statuses.push(status),
  });
  writers.push(writer);
  return writer;
}

afterEach(() => {
  for (const writer of writers.splice(0)) writer.stop();
  statuses.splice(0);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Canvas snapshots", () => {
  it("accepts proxy-weakened ETags and sends the next database revision", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce(
      new Response('{"version":2}', { headers: { ETag: 'W/"2"' } }),
    ).mockResolvedValueOnce(
      new Response('{"version":3}', { headers: { ETag: 'W/"3"' } }),
    );
    vi.stubGlobal("fetch", fetch);
    const document = new Y.Doc();
    createWriter(document, 1);
    document.getText("notes").insert(0, "first");
    await vi.advanceTimersByTimeAsync(CANVAS_SNAPSHOT_THROTTLE_MS);
    expect(statuses.at(-1)?.kind).toBe("saved");
    document.getText("notes").insert(5, " second");
    await vi.advanceTimersByTimeAsync(CANVAS_SNAPSHOT_THROTTLE_MS);
    expect(fetch.mock.calls[1][1].headers["If-Match"]).toBe('"2"');
    expect(statuses.at(-1)?.version).toBe(3);
  });

  it("restores a response whose ETag was weakened by the proxy", async () => {
    const stored = new Y.Doc();
    stored.getText("notes").insert(0, "قرار محفوظ");
    const response = snapshotResponse(Y.encodeStateAsUpdate(stored), 2);
    response.headers.set("ETag", 'W/"2"');
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const document = new Y.Doc();
    expect((await hydrateCanvasSnapshot(document, endpoint)).kind).toBe("restored");
    expect(document.getText("notes").toString()).toBe("قرار محفوظ");
  });

  it("retries a failed save without losing document edits", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { headers: { ETag: 'W/"1"' } }));
    vi.stubGlobal("fetch", fetch);
    const document = new Y.Doc();
    createWriter(document);
    document.getText("notes").insert(0, "still here");
    await vi.advanceTimersByTimeAsync(CANVAS_SNAPSHOT_THROTTLE_MS);
    expect(statuses.at(-1)?.kind).toBe("save_failed");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(statuses.at(-1)?.kind).toBe("saved");
    expect(document.getText("notes").toString()).toBe("still here");
  });

  it("applies a valid durable update before the document is connected to peers", async () => {
    const stored = new Y.Doc();
    stored.getText("notes").insert(0, "قرار: deploy بعد المراجعة");
    const update = Y.encodeStateAsUpdate(stored);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(snapshotResponse(update, 4, 7)));
    const document = new Y.Doc();
    const result = await hydrateCanvasSnapshot(document, endpoint);

    expect(result).toEqual({ kind: "restored", retentionDays: 7, version: 4 });
    expect(document.getText("notes").toString()).toBe("قرار: deploy بعد المراجعة");
  });

  it("fails closed when the server says the durable snapshot is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "snapshot_malformed" }), {
        status: 422,
        headers: { "X-LOR-Canvas-Retention-Days": "30" },
      })),
    );
    const document = new Y.Doc();

    const result = await hydrateCanvasSnapshot(document, endpoint);

    expect(result).toEqual({ kind: "malformed", retentionDays: 30, version: 0 });
    // The lifecycle creates a fresh doc before calling this helper. The bad
    // durable record leaves it empty rather than asking Yjs to repair it.
    expect(document.getText("notes").toString()).toBe("");
  });

  it("batches a burst of document updates into one binary database write", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ version: 1 }), { headers: { ETag: "\"1\"" } }),
    );
    vi.stubGlobal("fetch", fetch);
    const document = new Y.Doc();
    createWriter(document);

    document.getText("notes").insert(0, "one");
    document.getText("notes").insert(3, " two");
    document.getMap("board").set("shape", "rectangle");
    await vi.advanceTimersByTimeAsync(CANVAS_SNAPSHOT_THROTTLE_MS);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, request] = fetch.mock.calls[0] as [string, RequestInit];
    expect(request.method).toBe("PUT");
    expect(request.headers).toMatchObject({
      "Content-Type": CANVAS_SNAPSHOT_CONTENT_TYPE,
      "If-Match": "\"0\"",
    });
    expect(request.body).toBeInstanceOf(Uint8Array);
    expect(statuses.at(-1)).toEqual({ kind: "saved", retentionDays: 30, version: 1 });
  });

  it("merges a newer database snapshot after a conflict before retrying", async () => {
    vi.useFakeTimers();
    const remote = new Y.Doc();
    remote.getText("notes").insert(0, "من مشارك تاني");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "snapshot_conflict" }), { status: 409 }))
      .mockResolvedValueOnce(snapshotResponse(Y.encodeStateAsUpdate(remote), 1))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ version: 2 }), { headers: { ETag: "\"2\"" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const document = new Y.Doc();
    createWriter(document);
    document.getText("notes").insert(0, "من عندي + ");

    await vi.advanceTimersByTimeAsync(CANVAS_SNAPSHOT_THROTTLE_MS);
    await vi.advanceTimersByTimeAsync(CANVAS_SNAPSHOT_THROTTLE_MS);

    expect(fetch).toHaveBeenCalledTimes(3);
    const [, retry] = fetch.mock.calls[2] as [string, RequestInit];
    expect(retry.headers).toMatchObject({ "If-Match": "\"1\"" });
    expect(document.getText("notes").toString()).toContain("من عندي");
    expect(document.getText("notes").toString()).toContain("من مشارك تاني");
    expect(statuses.at(-1)).toEqual({ kind: "saved", retentionDays: 30, version: 2 });
  });
});
