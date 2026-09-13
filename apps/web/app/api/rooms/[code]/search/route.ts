import { NextResponse } from "next/server";
import { callerKey, clientAddress, consume } from "@/lib/rate-limit";
import { findRoomAccess } from "@/lib/room-access";
import { readSearchQuery } from "@/lib/search/contract";
import {
  indexSearchEvidence,
  searchIndexedEvidence,
  sweepSearchRetention,
} from "@/lib/search/repository";

const REQUESTER_SEARCHES_PER_MINUTE = 6;
const ROOM_SEARCHES_PER_MINUTE = 24;
const SEARCH_WINDOW_SECONDS = 60;

function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

function noStore(body: object, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

async function consumeSearchAllowance(roomId: string, headers: Headers) {
  const requester = clientAddress(headers);
  const [room, person] = await Promise.all([
    consume(
      await callerKey(`semantic-search:room:${roomId}`, "room"),
      ROOM_SEARCHES_PER_MINUTE,
      SEARCH_WINDOW_SECONDS,
    ),
    consume(
      await callerKey(`semantic-search:requester:${roomId}`, requester),
      REQUESTER_SEARCHES_PER_MINUTE,
      SEARCH_WINDOW_SECONDS,
    ),
  ]);
  const denied = [room, person].find((limit) => !limit.allowed);
  return denied ?? null;
}

async function authorizeAndValidate(rawCode: string, query: unknown, headers: Headers) {
  const room = await findRoomAccess(rawCode);
  if (!room) return { kind: "not_found" as const };
  const parsed = readSearchQuery(query);
  if (parsed.kind === "invalid") return { kind: "invalid" as const };
  const limited = await consumeSearchAllowance(room.id, headers);
  if (limited) return { kind: "limited" as const, resetAt: limited.resetAt };
  return { kind: "ready" as const, room, query: parsed.value };
}

function limitResponse(resetAt: Date) {
  const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
  return noStore(
    { error: "rate_limited", resetAt },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/**
 * Search an already-indexed room. GET is read-only: a client that merely opens
 * the workspace cannot trigger provider traffic for a whole past meeting.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/search">,
) {
  const { code } = await params;
  const query = new URL(request.url).searchParams.get("q");
  const access = await authorizeAndValidate(code, query, request.headers);
  if (access.kind === "not_found") return notFound();
  if (access.kind === "invalid") return noStore({ error: "query_invalid" }, { status: 400 });
  if (access.kind === "limited") return limitResponse(access.resetAt);

  await sweepSearchRetention(access.room.id);
  const search = await searchIndexedEvidence(access.room.id, access.query);
  return noStore({ query: access.query, ...search });
}

/**
 * Refresh a bounded projection, then search it. The browser can supply a query
 * only; all indexed text and source coordinates are resolved from this room's
 * retained server records.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/search">,
) {
  const { code } = await params;
  const body = await request.json().catch(() => null);
  const access = await authorizeAndValidate(code, body?.query, request.headers);
  if (access.kind === "not_found") return notFound();
  if (access.kind === "invalid") return noStore({ error: "query_invalid" }, { status: 400 });
  if (access.kind === "limited") return limitResponse(access.resetAt);

  const index = await indexSearchEvidence(access.room.id);
  const search = await searchIndexedEvidence(access.room.id, access.query);
  return noStore({ query: access.query, index, ...search });
}
