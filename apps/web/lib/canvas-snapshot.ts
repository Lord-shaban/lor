import * as Y from "yjs";
import {
  CANVAS_SNAPSHOT_CONTENT_TYPE,
  MAX_CANVAS_SNAPSHOT_BYTES,
  parseSnapshotEtag,
  snapshotEtag,
} from "@/lib/canvas-snapshot-protocol";
import { CANVAS_RETENTION_DAYS } from "@/lib/canvas-retention";

/** A short quiet period turns one drawing gesture into one durable write. */
export const CANVAS_SNAPSHOT_THROTTLE_MS = 2_000;

/** A transient outage gets another try without turning it into a request loop. */
const RETRY_AFTER_FAILURE_MS = 10_000;

export type CanvasSnapshotStatus =
  | { kind: "loading"; retentionDays: number; version: number }
  | { kind: "empty"; retentionDays: number; version: number }
  | { kind: "restored"; retentionDays: number; version: number }
  | { kind: "saved"; retentionDays: number; version: number }
  | { kind: "expired"; retentionDays: number; version: number }
  | { kind: "malformed"; retentionDays: number; version: number }
  | { kind: "unavailable"; retentionDays: number; version: number }
  | { kind: "save_failed"; retentionDays: number; version: number }
  | { kind: "too_large"; retentionDays: number; version: number }
  | { kind: "deleted"; retentionDays: number; version: number };

function retentionDays(response: Response) {
  const value = Number(response.headers.get("X-LOR-Canvas-Retention-Days"));
  return Number.isInteger(value) && value > 0 && value <= CANVAS_RETENTION_DAYS
    ? value
    : CANVAS_RETENTION_DAYS;
}

function version(response: Response) {
  return parseSnapshotEtag(response.headers.get("ETag"));
}

/**
 * Hydrate a fresh document before it is connected to LiveKit.
 *
 * Validation happens in an isolated Y.Doc first. A damaged binary update can
 * therefore never partially change the call's real document: the caller gets
 * an empty document and a state it can explain to the meeting instead.
 */
export async function hydrateCanvasSnapshot(
  document: Y.Doc,
  endpoint: string,
): Promise<CanvasSnapshotStatus> {
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    const days = retentionDays(response);

    if (response.status === 204) return { kind: "empty", retentionDays: days, version: 0 };
    if (response.status === 410) return { kind: "expired", retentionDays: days, version: 0 };
    if (response.status === 422) return { kind: "malformed", retentionDays: days, version: 0 };
    if (!response.ok) return { kind: "unavailable", retentionDays: days, version: 0 };

    const snapshotVersion = version(response);
    const contentType = response.headers.get("Content-Type")?.split(";", 1)[0];
    const update = new Uint8Array(await response.arrayBuffer());
    if (
      snapshotVersion === null ||
      contentType !== CANVAS_SNAPSHOT_CONTENT_TYPE ||
      update.byteLength === 0 ||
      update.byteLength > MAX_CANVAS_SNAPSHOT_BYTES
    ) {
      return { kind: "malformed", retentionDays: days, version: 0 };
    }

    const probe = new Y.Doc();
    try {
      Y.applyUpdate(probe, update);
    } catch {
      return { kind: "malformed", retentionDays: days, version: 0 };
    } finally {
      probe.destroy();
    }

    Y.applyUpdate(document, update, "canvas-snapshot");
    return { kind: "restored", retentionDays: days, version: snapshotVersion };
  } catch {
    return {
      kind: "unavailable",
      retentionDays: CANVAS_RETENTION_DAYS,
      version: 0,
    };
  }
}

interface CanvasSnapshotWriterOptions {
  document: Y.Doc;
  endpoint: string;
  version: number;
  retentionDays: number;
  onStatus: (status: CanvasSnapshotStatus) => void;
}

/**
 * Persist the whole Yjs state after edits settle.
 *
 * Full Yjs updates are commutative, but database replacements are not. The
 * version precondition makes the replacement conditional; after a conflict we
 * merge the latest stored update into this document before trying again.
 */
export class CanvasSnapshotWriter {
  private readonly document: Y.Doc;
  private readonly endpoint: string;
  private readonly retentionDays: number;
  private readonly onStatus: (status: CanvasSnapshotStatus) => void;
  private version: number;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;
  private writing = false;
  private stopped = false;

  constructor({
    document,
    endpoint,
    version,
    retentionDays,
    onStatus,
  }: CanvasSnapshotWriterOptions) {
    this.document = document;
    this.endpoint = endpoint;
    this.version = version;
    this.retentionDays = retentionDays;
    this.onStatus = onStatus;
    this.document.on("update", this.onDocumentUpdate);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.document.off("update", this.onDocumentUpdate);
  }

  private readonly onDocumentUpdate = () => {
    if (this.stopped) return;
    this.dirty = true;
    this.schedule(CANVAS_SNAPSHOT_THROTTLE_MS);
  };

  private schedule(delay: number) {
    if (this.stopped || this.timer || this.writing) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, delay);
  }

  private async flush() {
    if (this.stopped || this.writing || !this.dirty) return;
    this.writing = true;
    this.dirty = false;
    let retryAfter: number | undefined;

    const update = Y.encodeStateAsUpdate(this.document);
    if (update.byteLength > MAX_CANVAS_SNAPSHOT_BYTES) {
      this.onStatus({
        kind: "too_large",
        retentionDays: this.retentionDays,
        version: this.version,
      });
      this.writing = false;
      return;
    }

    try {
      const response = await fetch(this.endpoint, {
        method: "PUT",
        cache: "no-store",
        headers: {
          "Content-Type": CANVAS_SNAPSHOT_CONTENT_TYPE,
          "If-Match": snapshotEtag(this.version),
        },
        // A fresh view has an ArrayBuffer-backed type for the DOM fetch API;
        // Yjs itself correctly exposes the wider ArrayBufferLike type.
        body: new Uint8Array(update),
      });

      if (response.status === 409) {
        const latest = await hydrateCanvasSnapshot(this.document, this.endpoint);
        if (
          latest.kind === "restored" ||
          latest.kind === "empty" ||
          latest.kind === "expired" ||
          latest.kind === "malformed"
        ) {
          this.version = latest.version;
          this.dirty = true;
        } else {
          this.onStatus(latest);
        }
        return;
      }

      if (response.status === 413) {
        this.onStatus({
          kind: "too_large",
          retentionDays: this.retentionDays,
          version: this.version,
        });
        return;
      }

      const nextVersion = version(response);
      if (!response.ok || nextVersion === null) {
        this.dirty = true;
        this.onStatus({
          kind: "save_failed",
          retentionDays: this.retentionDays,
          version: this.version,
        });
        retryAfter = RETRY_AFTER_FAILURE_MS;
        return;
      }

      this.version = nextVersion;
      this.onStatus({
        kind: "saved",
        retentionDays: this.retentionDays,
        version: this.version,
      });
    } catch {
      this.dirty = true;
      this.onStatus({
        kind: "save_failed",
        retentionDays: this.retentionDays,
        version: this.version,
      });
      retryAfter = RETRY_AFTER_FAILURE_MS;
    } finally {
      this.writing = false;
      if (this.dirty) this.schedule(retryAfter ?? CANVAS_SNAPSHOT_THROTTLE_MS);
    }
  }
}
