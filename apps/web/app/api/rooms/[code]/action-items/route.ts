import { NextResponse } from "next/server";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import {
  MAX_ACTION_ITEM_TEXT_LENGTH,
  actionItems,
  completeActionItem,
  getDb,
  isCalendarDate,
  openActionItem,
  reopenActionItem,
  transcriptLines,
} from "@lor/db";
import { participantIdentity } from "@/lib/livekit";
import { findRoomAccess, hasRoomHostAccess } from "@/lib/room-access";
import { keptSince, retentionDays } from "@/lib/stt/retention";
import { sweepTranscript } from "@/lib/transcript-retention";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_HEADER = "x-lor-session-id";

function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

function isActionItemId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function actionItemText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= MAX_ACTION_ITEM_TEXT_LENGTH ? text : null;
}

function actionItemDueOn(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null;
}

/**
 * The session secret is a bearer proof held in this browser tab, not an account
 * identifier sent by the caller. The API derives the opaque LiveKit identity
 * from it and never accepts an identity field from the browser.
 */
async function sessionParticipantIdentity(
  headers: Headers,
  livekitRoom: string,
): Promise<string | null> {
  const sessionId = headers.get(SESSION_HEADER);
  if (!sessionId || sessionId.length < 16 || sessionId.length > 128) return null;
  return participantIdentity(livekitRoom, sessionId);
}

/**
 * Read only retained, evidence-backed items. Guests never receive proposals;
 * the host-only participant list is drawn from the same retained record that
 * the database trigger uses for canonical display-name snapshots.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/action-items">,
) {
  const { code: rawCode } = await params;
  const room = await findRoomAccess(rawCode);
  if (!room) return notFound();
  const isHost = await hasRoomHostAccess(room);
  const callerIdentity = await sessionParticipantIdentity(request.headers, room.livekitRoom);

  const db = getDb();
  const days = retentionDays(process.env);
  const cutoff = keptSince(new Date(), days);
  await sweepTranscript(room.id, cutoff);

  const conditions = [
    eq(actionItems.roomId, room.id),
    gte(transcriptLines.createdAt, cutoff),
  ];
  if (!isHost) conditions.push(inArray(actionItems.status, ["open", "completed"]));

  const records = await db
    .select({
      id: actionItems.id,
      status: actionItems.status,
      origin: actionItems.origin,
      text: actionItems.text,
      assigneeIdentity: actionItems.assigneeIdentity,
      assigneeName: actionItems.assigneeName,
      dueOn: actionItems.dueOn,
      createdAt: actionItems.createdAt,
      openedAt: actionItems.openedAt,
      completedAt: actionItems.completedAt,
      seq: transcriptLines.seq,
      speaker: transcriptLines.speakerName,
      quote: transcriptLines.text,
      sourceAt: transcriptLines.createdAt,
    })
    .from(actionItems)
    .innerJoin(transcriptLines, eq(actionItems.sourceLineId, transcriptLines.id))
    .where(and(...conditions))
    .orderBy(asc(transcriptLines.seq), asc(actionItems.createdAt));

  const participants = isHost
    ? await db
      .select({
        identity: transcriptLines.speakerIdentity,
        name: transcriptLines.speakerName,
        createdAt: transcriptLines.createdAt,
        id: transcriptLines.id,
      })
      .from(transcriptLines)
      .where(and(eq(transcriptLines.roomId, room.id), gte(transcriptLines.createdAt, cutoff)))
      .orderBy(desc(transcriptLines.createdAt), desc(transcriptLines.id))
    : [];
  const latestParticipants = new Map<string, string>();
  for (const participant of participants) {
    if (!latestParticipants.has(participant.identity)) {
      latestParticipants.set(participant.identity, participant.name);
    }
  }

  return NextResponse.json(
    {
      canReview: isHost,
      retentionDays: days,
      participants: isHost
        ? [...latestParticipants].map(([identity, name]) => ({ identity, name }))
        : [],
      actionItems: records.map((item) => ({
        id: item.id,
        status: item.status,
        origin: item.origin,
        text: item.text,
        // Identity is returned only to the current host so the selected option
        // can be server-validated on open; guests see only the display name.
        ...(isHost ? { assigneeIdentity: item.assigneeIdentity } : {}),
        assigneeName: item.assigneeName,
        dueOn: item.dueOn,
        createdAt: item.createdAt,
        openedAt: item.openedAt,
        completedAt: item.completedAt,
        canComplete: item.status === "open"
          && (isHost || (callerIdentity !== null && callerIdentity === item.assigneeIdentity)),
        source: {
          seq: item.seq,
          speaker: item.speaker,
          quote: item.quote,
          at: item.sourceAt,
        },
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Host review, owner completion, and host status override for one item. */
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/action-items">,
) {
  const { code: rawCode } = await params;
  const room = await findRoomAccess(rawCode);
  if (!room) return notFound();
  const isHost = await hasRoomHostAccess(room);

  const body = await request.json().catch(() => null);
  if (!isActionItemId(body?.id)) return notFound();

  const db = getDb();
  const cutoff = keptSince(new Date(), retentionDays(process.env));
  await sweepTranscript(room.id, cutoff);

  if (body?.action === "open") {
    if (!isHost) return notFound();
    const text = actionItemText(body?.text);
    const assigneeIdentity = typeof body?.assigneeIdentity === "string"
      ? body.assigneeIdentity.trim()
      : "";
    const dueOn = actionItemDueOn(body?.dueOn);
    if (!text) return NextResponse.json({ error: "action_item_text_invalid" }, { status: 400 });
    if (!assigneeIdentity) return NextResponse.json({ error: "action_item_owner_invalid" }, { status: 400 });
    if (!dueOn || !isCalendarDate(dueOn)) {
      return NextResponse.json({ error: "action_item_due_invalid" }, { status: 400 });
    }

    // This is a route-level check in addition to the database trigger. It
    // limits assignment to a still-retained, room-local participant before the
    // status transition and never trusts a display name from the browser.
    const [participant] = await db
      .select({ identity: transcriptLines.speakerIdentity })
      .from(transcriptLines)
      .where(and(
        eq(transcriptLines.roomId, room.id),
        eq(transcriptLines.speakerIdentity, assigneeIdentity),
        gte(transcriptLines.createdAt, cutoff),
      ))
      .limit(1);
    if (!participant) return NextResponse.json({ error: "action_item_owner_invalid" }, { status: 400 });

    let opened: Awaited<ReturnType<typeof openActionItem>>;
    try {
      opened = await openActionItem(db, {
        roomId: room.id,
        id: body.id,
        text,
        assigneeIdentity,
        dueOn,
      });
    } catch {
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    return opened.length > 0
      ? NextResponse.json(opened[0])
      : notFound();
  }

  if (body?.action === "edit") {
    if (!isHost) return notFound();
    const text = actionItemText(body?.text);
    if (!text) return NextResponse.json({ error: "action_item_text_invalid" }, { status: 400 });
    const [edited] = await db
      .update(actionItems)
      .set({ text })
      .where(and(
        eq(actionItems.id, body.id),
        eq(actionItems.roomId, room.id),
        eq(actionItems.status, "proposed"),
      ))
      .returning({ id: actionItems.id, status: actionItems.status, text: actionItems.text });
    return edited ? NextResponse.json(edited) : notFound();
  }

  if (body?.action === "complete") {
    const assigneeIdentity = isHost
      ? undefined
      : (await sessionParticipantIdentity(request.headers, room.livekitRoom)) ?? undefined;
    if (!isHost && !assigneeIdentity) return notFound();
    let completed: Awaited<ReturnType<typeof completeActionItem>>;
    try {
      completed = await completeActionItem(db, {
        roomId: room.id,
        id: body.id,
        assigneeIdentity,
      });
    } catch {
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    return completed.length > 0
      ? NextResponse.json(completed[0])
      : notFound();
  }

  if (body?.action === "reopen") {
    if (!isHost) return notFound();
    let reopened: Awaited<ReturnType<typeof reopenActionItem>>;
    try {
      reopened = await reopenActionItem(db, { roomId: room.id, id: body.id });
    } catch {
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    return reopened.length > 0
      ? NextResponse.json(reopened[0])
      : notFound();
  }

  return NextResponse.json({ error: "action_item_action_invalid" }, { status: 400 });
}

/** Delete a record, never the immutable transcript evidence it cites. */
export async function DELETE(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/action-items">,
) {
  const { code: rawCode } = await params;
  const room = await findRoomAccess(rawCode);
  if (!room || !(await hasRoomHostAccess(room))) return notFound();

  const body = await request.json().catch(() => null);
  if (!isActionItemId(body?.id)) return notFound();

  const [deleted] = await getDb()
    .delete(actionItems)
    .where(and(eq(actionItems.id, body.id), eq(actionItems.roomId, room.id)))
    .returning({ id: actionItems.id });
  return deleted ? NextResponse.json({ deleted: true }) : notFound();
}
