/** The media type is deliberately not JSON: Yjs updates are binary. */
export const CANVAS_SNAPSHOT_CONTENT_TYPE = "application/vnd.lor.canvas+yjs";

/** The stored Yjs encoding, not the optimistic database row version. */
export const CANVAS_SNAPSHOT_FORMAT_VERSION = 1;

/**
 * Keep the durable path inside the same bounded envelope as one LiveKit state
 * transfer. A larger document needs a future, explicitly designed storage
 * format rather than an accidental unbounded serverless request.
 */
export const MAX_CANVAS_SNAPSHOT_BYTES = 2 * 1024 * 1024;

export function snapshotEtag(version: number) {
  return `"${version}"`;
}

export function parseSnapshotEtag(value: string | null) {
  // Proxies may weaken response ETags during compression. This tag carries
  // our database revision, not a byte-for-byte HTTP representation checksum.
  const match = value?.match(/^(?:W\/)?"(\d+)"$/);
  if (!match) return null;

  const version = Number(match[1]);
  return Number.isSafeInteger(version) && version >= 0 ? version : null;
}
