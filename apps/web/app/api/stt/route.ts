import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, rooms } from "@lor/db";
import { callerKey, clientAddress, consume } from "@/lib/rate-limit";
import { normalizeRoomCode } from "@/lib/room-code";
import { readGlossary } from "@/lib/stt/glossary";
import { buildPrompt } from "@/lib/stt/prompt";
import { applyRepairs, readRepairs } from "@/lib/stt/repair";
import { quotaLimits, shouldWarn, tightest, type QuotaState } from "@/lib/stt/quota";
import { MAX_AUDIO_BYTES, planRequest } from "@/lib/stt/request";
import { FAILURE_STATUS, transcribe } from "@/lib/stt/transcribe";
import { wavDuration } from "@/lib/stt/wav";

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

/** A day, so a counter cannot outlive the key it belongs to. */
const DAY_SECONDS = 24 * 60 * 60;

/**
 * When the allowance comes back.
 *
 * Not the counter's own window, which runs twenty-four hours from whenever it
 * was first touched. `callerKey` salts with the date, so at UTC midnight the
 * key itself changes and the count starts from nothing — that is the moment
 * somebody gets their captions back, and telling them anything else is telling
 * them to wait longer than they have to.
 */
function nextReset(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
}

/** Enough to walk past any chunk an encoder writes before the audio itself. */
const HEADER_BYTES = 4096;

/**
 * Longer than `vad.ts` will ever emit, with room to spare.
 *
 * Not a size limit — `MAX_AUDIO_BYTES` is that. This is a sanity bound on what
 * the *header* claims, so a file whose length field is wrong cannot empty an
 * allowance in one request.
 */
const MAX_UTTERANCE_SECONDS = 120;

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

  // Seconds of audio, read from the file's own header rather than taken from
  // the request: this is what the quota is charged against, and the client is
  // the party with an interest in the number being smaller. Four kilobytes is
  // enough to walk past any chunk an encoder puts before the audio, and small
  // enough that nothing is really buffered to ask.
  const seconds = wavDuration(await plan.audio.slice(0, HEADER_BYTES).arrayBuffer());

  // A header that cannot be read, or one claiming more audio than the detector
  // will ever produce. Both mean the file is not what it says it is, and
  // charging a quota against a number from a file we could not parse is how a
  // five-second recording once cost sixty-three hours of somebody's allowance.
  if (seconds === null || seconds > MAX_UTTERANCE_SECONDS) {
    return NextResponse.json({ error: "rejected" }, { status: 422 });
  }

  // Nobody using their own key is rationed. They are paying.
  const quotas: QuotaState[] = [];
  if (!plan.usingOwnKey) {
    for (const limit of quotaLimits(process.env)) {
      // A ceiling of nothing. `.env.example` calls this "disable your key
      // entirely and require BYOK", and it is answered exactly like an
      // exhausted allowance so the client needs no second case — the way past
      // it is the same one either way. No counter is written for a ceiling
      // that can never be satisfied.
      if (limit.seconds === 0) {
        const resetAt = nextReset();
        return NextResponse.json(
          { error: "quota", scope: limit.scope, resetAt: resetAt.toISOString() },
          { status: 429 },
        );
      }

      const scopeId =
        limit.scope === "user"
          ? clientAddress(request.headers)
          : limit.scope === "room"
            ? room.id
            : "all";

      // The key carries the date, so the reset boundary is UTC midnight and is
      // the same one for every scope — a documented instant rather than
      // whenever each counter happened to start.
      const used = await consume(
        await callerKey(`sttq:${limit.scope}`, scopeId),
        limit.seconds,
        DAY_SECONDS,
        seconds,
      );

      quotas.push({
        scope: limit.scope,
        limit: limit.seconds,
        remaining: used.remaining,
      });

      if (!used.allowed) {
        const resetAt = nextReset();

        // Captions stop. Nothing else does — video, audio, screen share, chat
        // and the rest of the meeting are unaffected, which is the invariant.
        return NextResponse.json(
          { error: "quota", scope: limit.scope, resetAt: resetAt.toISOString() },
          {
            status: 429,
            headers: {
              "Retry-After": String(
                Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
              ),
            },
          },
        );
      }
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

  // What is left goes back on every call, not only the last one: a room warned
  // at eighty per cent can fetch a key, and a room told at a hundred has
  // already lost its captions mid-sentence.
  const worst = tightest(quotas);

  // The only thing that survives this request.
  return NextResponse.json(
    {
      text,
      ...(worst && shouldWarn(worst)
        ? { quota: { scope: worst.scope, remaining: worst.remaining, limit: worst.limit } }
        : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
