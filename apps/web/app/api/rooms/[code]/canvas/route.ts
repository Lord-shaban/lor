import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import * as Y from "yjs";
import { canvasSnapshots, getDb, rooms } from "@lor/db";
import {
  CANVAS_SNAPSHOT_CONTENT_TYPE,
  CANVAS_SNAPSHOT_FORMAT_VERSION,
  MAX_CANVAS_SNAPSHOT_BYTES,
  parseSnapshotEtag,
  snapshotEtag,
} from "@/lib/canvas-snapshot-protocol";
import { canvasKeptSince, canvasRetentionDays } from "@/lib/canvas-retention";
import { normalizeRoomCode } from "@/lib/room-code";

/** The only server route through which a browser can read or write Canvas data. */
async function findRoom(rawCode: string) {
  const code = normalizeRoomCode(rawCode);
  if (!code) return null;

  const db = getDb();
  const [room] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  return room ?? null;
}

function headersFor(version?: number, retentionDays?: number) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-LOR-Canvas-Format": String(CANVAS_SNAPSHOT_FORMAT_VERSION),
  });
  if (version !== undefined) headers.set("ETag", snapshotEtag(version));
  if (retentionDays !== undefined) {
    headers.set("X-LOR-Canvas-Retention-Days", String(retentionDays));
  }
  return headers;
}

function isValidYjsUpdate(update: Uint8Array) {
  const document = new Y.Doc();
  try {
    Y.applyUpdate(document, update);
    return true;
  } catch {
    return false;
  } finally {
    document.destroy();
  }
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/rooms/[code]/canvas">,
) {
  const { code } = await params;
  const room = await findRoom(code);
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const db = getDb();
  const days = canvasRetentionDays(process.env);
  const [snapshot] = await db
    .select({
      document: canvasSnapshots.document,
      updatedAt: canvasSnapshots.updatedAt,
      version: canvasSnapshots.version,
    })
    .from(canvasSnapshots)
    .where(eq(canvasSnapshots.roomId, room.id))
    .limit(1);

  if (!snapshot) return new Response(null, { status: 204, headers: headersFor(0, days) });

  if (snapshot.updatedAt < canvasKeptSince(new Date(), days)) {
    await db.delete(canvasSnapshots).where(eq(canvasSnapshots.roomId, room.id));
    return NextResponse.json(
      { error: "snapshot_expired" },
      { status: 410, headers: headersFor(0, days) },
    );
  }

  const update = new Uint8Array(snapshot.document);
  if (update.byteLength > MAX_CANVAS_SNAPSHOT_BYTES || !isValidYjsUpdate(update)) {
    // A row that cannot be decoded must not keep failing every rejoin. Delete
    // only this room's one durable copy, then let the call recover from empty.
    await db.delete(canvasSnapshots).where(eq(canvasSnapshots.roomId, room.id));
    return NextResponse.json(
      { error: "snapshot_malformed" },
      { status: 422, headers: headersFor(0, days) },
    );
  }

  const headers = headersFor(snapshot.version, days);
  headers.set(
    "Content-Type",
    `${CANVAS_SNAPSHOT_CONTENT_TYPE}; version=${CANVAS_SNAPSHOT_FORMAT_VERSION}`,
  );
  return new Response(update, { headers });
}

export async function PUT(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/canvas">,
) {
  const { code } = await params;
  const room = await findRoom(code);
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const expectedVersion = parseSnapshotEtag(request.headers.get("If-Match"));
  if (expectedVersion === null) {
    return NextResponse.json({ error: "snapshot_version_missing" }, { status: 400 });
  }

  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0];
  if (contentType !== CANVAS_SNAPSHOT_CONTENT_TYPE) {
    return NextResponse.json({ error: "snapshot_content_type" }, { status: 415 });
  }

  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CANVAS_SNAPSHOT_BYTES) {
    return NextResponse.json({ error: "snapshot_too_large" }, { status: 413 });
  }

  const update = new Uint8Array(await request.arrayBuffer());
  if (update.byteLength === 0 || update.byteLength > MAX_CANVAS_SNAPSHOT_BYTES) {
    return NextResponse.json({ error: "snapshot_too_large" }, { status: 413 });
  }
  if (!isValidYjsUpdate(update)) {
    return NextResponse.json({ error: "snapshot_malformed" }, { status: 422 });
  }

  const db = getDb();
  const document = Buffer.from(update);

  if (expectedVersion === 0) {
    const [created] = await db
      .insert(canvasSnapshots)
      .values({ roomId: room.id, document })
      .onConflictDoNothing()
      .returning({ version: canvasSnapshots.version });

    if (created) {
      return NextResponse.json(
        { version: created.version },
        { status: 201, headers: headersFor(created.version) },
      );
    }
  } else {
    const [updated] = await db
      .update(canvasSnapshots)
      .set({
        document,
        version: sql`${canvasSnapshots.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(canvasSnapshots.roomId, room.id),
          eq(canvasSnapshots.version, expectedVersion),
        ),
      )
      .returning({ version: canvasSnapshots.version });

    if (updated) {
      return NextResponse.json(
        { version: updated.version },
        { headers: headersFor(updated.version) },
      );
    }
  }

  // A full document from an older browser must merge with the newer snapshot
  // first. The client fetches, applies that Yjs update, then retries with the
  // returned version instead of overwriting a peer's state.
  return NextResponse.json({ error: "snapshot_conflict" }, { status: 409 });
}

/**
 * Remove the single durable Canvas copy. Board and notes share that copy, so a
 * delete cannot accidentally leave one representation behind.
 */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/rooms/[code]/canvas">,
) {
  const { code } = await params;
  const room = await findRoom(code);
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const db = getDb();
  const deleted = await db
    .delete(canvasSnapshots)
    .where(eq(canvasSnapshots.roomId, room.id))
    .returning({ roomId: canvasSnapshots.roomId });

  return NextResponse.json(
    { deleted: deleted.length > 0 },
    { headers: headersFor(0) },
  );
}
