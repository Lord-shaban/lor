import "server-only";
import { sql } from "drizzle-orm";
import { getDb, rateLimits } from "@lor/db";

/**
 * A fixed-window rate limiter that lives in the database.
 *
 * An in-memory counter is worthless here: route handlers run on many instances
 * at once, each would keep its own count, and the effective limit would be the
 * configured one multiplied by however many happen to be warm.
 *
 * Fixed windows allow a burst across a boundary — up to twice the limit if a
 * caller lands either side of it. For "how many rooms may one person create an
 * hour" that is fine, and it costs one statement instead of the sorted set a
 * sliding window needs.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** How many requests remain in the current window. Never negative. */
  remaining: number;
  /** When the current window ends. Suitable for a Retry-After header. */
  resetAt: Date;
}

/**
 * Identify a caller without keeping something that can follow them around.
 *
 * The address is hashed together with the signing key and the current date, so
 * the stored key is opaque, cannot be reversed into an address, and cannot be
 * correlated with the same person tomorrow.
 */
export async function callerKey(
  prefix: string,
  address: string,
): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.LOR_HOST_COOKIE_SECRET ?? "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${prefix}:${day}:${salt}:${address}`),
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Half a SHA-256 is 128 bits: far beyond any collision that matters for a
  // counter, and it keeps the primary key small.
  return `${prefix}:${hex.slice(0, 32)}`;
}

/**
 * Count something against a key.
 *
 * The whole thing is a single statement so that two simultaneous requests
 * cannot both read the same count and both decide they are under the limit.
 * The window resets inside the statement rather than being pruned by a job.
 *
 * `cost` is how much this one call is worth. One, for "how many requests"; for
 * a quota it is seconds of audio, because a request is not a cost — a
 * twenty-second utterance and a one-second one are the same request and twenty
 * times the bill.
 */
export async function consume(
  key: string,
  limit: number,
  windowSeconds: number,
  cost = 1,
): Promise<RateLimitResult> {
  const db = getDb();
  const interval = sql.raw(`interval '${windowSeconds} seconds'`);
  // Rounded up and at least one: a caller cannot make an unlimited number of
  // free requests by keeping each one just under a second.
  const charge = Math.max(1, Math.ceil(cost));

  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: charge })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case
          when ${rateLimits.windowStart} < now() - ${interval}
          then ${charge}
          else ${rateLimits.count} + ${charge}
        end`,
        windowStart: sql`case
          when ${rateLimits.windowStart} < now() - ${interval}
          then now()
          else ${rateLimits.windowStart}
        end`,
      },
    })
    .returning({
      count: rateLimits.count,
      windowStart: rateLimits.windowStart,
    });

  const resetAt = new Date(row.windowStart.getTime() + windowSeconds * 1000);

  return {
    allowed: row.count <= limit,
    remaining: Math.max(0, limit - row.count),
    resetAt,
  };
}

/**
 * The client address, as reported by the platform.
 *
 * `x-forwarded-for` is trivially spoofable in general, but behind a proxy that
 * rewrites it — which is what both Vercel and a correctly configured reverse
 * proxy do — the first entry is the real peer. A self-hoster who exposes the app
 * directly should put a proxy in front of it; that is the documented setup.
 *
 * Falling back to a constant means an unknown address shares one bucket with
 * every other unknown address. That is the safe direction to fail: worst case
 * some legitimate requests are throttled, rather than the limit disappearing.
 */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
