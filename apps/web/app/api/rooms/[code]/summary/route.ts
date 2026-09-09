import { NextResponse } from "next/server";
import { and, asc, eq, gte } from "drizzle-orm";
import { getDb, rooms, summaries, transcriptLines } from "@lor/db";
import { callerKey, clientAddress, consume } from "@/lib/rate-limit";
import { normalizeRoomCode } from "@/lib/room-code";
import { keptSince, retentionDays } from "@/lib/stt/retention";
import { estimatedTokens, buildTranscript, summarise } from "@/lib/llm/summarise";
import { configuredLlm } from "@/lib/llm/provider";

/**
 * Turn a stored transcript into something somebody who missed the call can act
 * on.
 *
 * Deliberately not automatic. A summary costs money and a meeting is not over
 * because it went quiet, so it is asked for. Once made it is stored and served
 * from storage — asking twice for the same meeting should not cost twice.
 *
 * Like `/api/stt`, this forwards and returns: the key comes from the
 * environment at call time, appears in one header, and reaches no log, no
 * response and no row.
 */

/**
 * A summary is far more expensive than an utterance, so the ceiling is counted
 * in requests rather than seconds and it is small. Three a day per room is more
 * than a meeting needs and much less than a loop can spend.
 */
const SUMMARIES_PER_DAY = 3;
const DAY_SECONDS = 24 * 60 * 60;

/** Long enough for a long transcript, short enough for a serverless handler. */
const TIMEOUT_MS = 45_000;

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/summary">,
) {
  const { code: rawCode } = await params;
  const code = normalizeRoomCode(rawCode);
  if (!code) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const db = getDb();
  const [room] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const llm = configuredLlm(process.env);

  // The meeting keeps its transcript either way. Only the summary is missing,
  // which is the documented degradation rather than a failure.
  if (!llm) {
    return NextResponse.json({ error: "no_key" }, { status: 503 });
  }

  const lines = await db
    .select({
      speaker: transcriptLines.speakerName,
      text: transcriptLines.text,
    })
    .from(transcriptLines)
    .where(
      and(
        eq(transcriptLines.roomId, room.id),
        gte(transcriptLines.createdAt, keptSince(new Date(), retentionDays(process.env))),
      ),
    )
    .orderBy(asc(transcriptLines.seq));

  if (lines.length === 0) {
    return NextResponse.json({ error: "nothing_to_summarise" }, { status: 404 });
  }

  // Counted where the cost is, and after the transcript is known to exist: a
  // request that was never going to spend anything should not spend a slot.
  const limit = await consume(
    await callerKey("summary", `${room.id}:${clientAddress(request.headers)}`),
    SUMMARIES_PER_DAY,
    DAY_SECONDS,
  );
  if (!limit.allowed) {
    return NextResponse.json({ error: "quota" }, { status: 429 });
  }

  const result = await summarise({
    lines,
    endpoint: llm.endpoint,
    model: llm.model,
    key: llm.key,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!result.ok || !result.text) {
    return NextResponse.json(
      { error: result.failure ?? "unavailable" },
      { status: result.failure === "quota" ? 429 : result.failure === "no_key" ? 502 : 503 },
    );
  }

  // One current summary per room, replaced rather than appended. Keeping every
  // draft would mean keeping the transcript's contents somewhere else that
  // deletion has to remember about.
  await db
    .insert(summaries)
    .values({ roomId: room.id, text: result.text, fromLines: lines.length })
    .onConflictDoUpdate({
      target: summaries.roomId,
      set: { text: result.text, fromLines: lines.length, createdAt: new Date() },
    });

  return NextResponse.json(
    {
      text: result.text,
      fromLines: lines.length,
      estimatedTokens: estimatedTokens(buildTranscript(lines)),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
