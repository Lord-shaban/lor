import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, rooms } from "@lor/db";
import { callerKey, clientAddress, consume } from "@/lib/rate-limit";
import { normalizeRoomCode } from "@/lib/room-code";
import { readGlossary } from "@/lib/stt/glossary";
import { buildPrompt } from "@/lib/stt/prompt";
import { applyRepairs, readRepairs } from "@/lib/stt/repair";
import { MAX_AUDIO_BYTES, planRequest } from "@/lib/stt/request";
import { FAILURE_STATUS, transcribe } from "@/lib/stt/transcribe";

/**
 * Audio in, text out, nothing kept.
 *
 * The whole route is here rather than spread across helpers because its value
 * is in how little it does, and that is easier to see in forty lines than in
 * four files. `lib/stt/request.ts` decides what a request is allowed to be and
 * `lib/stt/transcribe.ts` talks to the provider; both are tested. This joins
 * them, counts the request, and returns.
 *
 * What it deliberately never does: log, cache, or persist the audio, the text,
 * or either key. Not on success and not on failure — a `console.error(error)`
 * on a rejected fetch is exactly how a request body reaches a log aggregator.
 * `SECURITY.md` promises this publicly; the tests in `lib/stt/` hold the parts
 * that can be asserted, and the absence of a `console` call in this file is the
 * rest of it.
 */

/**
 * Enough for a long meeting, not enough to be a way of spending somebody's
 * credit.
 *
 * An utterance is at most twenty seconds, so this is roughly forty minutes of
 * continuous talking from one room in five minutes — more than a room can
 * produce, which is the point. It bounds the damage without being a limit
 * anybody meets. Real rationing is #90.
 */
const UTTERANCES_PER_WINDOW = 240;
const WINDOW_SECONDS = 5 * 60;

/**
 * Twenty-five seconds.
 *
 * Longer than a transcription of a twenty-second utterance takes, and short
 * enough to stay inside a serverless function's own limit — a handler killed by
 * the platform returns nothing at all, and the client cannot tell that apart
 * from a bug.
 */
const PROVIDER_TIMEOUT_MS = 25_000;

export async function POST(request: Request) {
  // Before reading the body, not after. `formData()` buffers the whole thing,
  // so checking the size only once it is parsed means having already accepted
  // whatever was sent.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "audio_too_large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "audio_missing" }, { status: 400 });
  }

  const plan = planRequest(form, request.headers, process.env);
  if (!plan.ok) {
    return NextResponse.json({ error: plan.error }, { status: plan.status });
  }

  const code = normalizeRoomCode(plan.code);
  if (!code) {
    return NextResponse.json({ error: "room_missing" }, { status: 400 });
  }

  const db = getDb();
  const [room] = await db
    .select({ id: rooms.id, settings: rooms.settings })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  if (!room) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Counted per room and only once the room is known to exist, which is the
  // lesson the knock limiter taught: a limit charged at the top of a handler is
  // charged for requests that were never going to cost anything.
  //
  // Somebody using their own key is not rationed at all. They are paying.
  if (!plan.usingOwnKey) {
    const limit = await consume(
      await callerKey("stt", `${room.id}:${clientAddress(request.headers)}`),
      UTTERANCES_PER_WINDOW,
      WINDOW_SECONDS,
    );

    if (!limit.allowed) {
      return NextResponse.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000)),
            ),
          },
        },
      );
    }
  }

  const result = await transcribe({
    audio: plan.audio,
    provider: plan.provider,
    model: plan.model,
    key: plan.key,
    // Built here, from the room, never taken from the request: a
    // client-supplied prompt is untrusted text sent to a metered API on the
    // operator's key.
    prompt: buildPrompt(readGlossary(room.settings)),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.failure },
      { status: FAILURE_STATUS[result.failure] },
    );
  }

  // After the engine and before anybody reads it. A term this room has already
  // corrected once should not come back wrong on the next line.
  const text = applyRepairs(result.text, readRepairs(room.settings));

  // The only thing that survives this request.
  return NextResponse.json(
    { text },
    { headers: { "Cache-Control": "no-store" } },
  );
}
