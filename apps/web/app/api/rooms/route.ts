import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, rooms } from "@lor/db";
import {
  createHostCredential,
  hostCookieName,
  hostCookieOptions,
} from "@/lib/host-cookie";
import { callerKey, clientAddress, consume } from "@/lib/rate-limit";
import { generateUniqueRoomCode } from "@/lib/room-code";
import { routing, type Locale } from "@/i18n/routing";

/** Ten rooms an hour is far above real use and well below useful abuse. */
const ROOMS_PER_HOUR = 10;
const WINDOW_SECONDS = 60 * 60;

/**
 * Create a room.
 *
 * The response carries the code; the host credential goes back as an httpOnly
 * cookie the caller never sees. That is the whole account system.
 */
export async function POST(request: Request) {
  const requestHeaders = await headers();

  const limit = await consume(
    await callerKey("rooms", clientAddress(requestHeaders)),
    ROOMS_PER_HOUR,
    WINDOW_SECONDS,
  );

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: limit.resetAt.toISOString() },
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

  // The only thing a caller may choose. Anything else is server-decided, so a
  // crafted request cannot pre-set a code or a host secret.
  const body = await request.json().catch(() => ({}));
  const requested = typeof body?.locale === "string" ? body.locale : undefined;
  const locale: Locale = routing.locales.includes(requested as Locale)
    ? (requested as Locale)
    : routing.defaultLocale;

  const db = getDb();

  const code = await generateUniqueRoomCode(async (candidate) => {
    const existing = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.code, candidate))
      .limit(1);
    return existing.length > 0;
  });

  const { secretHash, cookieValue } = await createHostCredential(code);

  await db.insert(rooms).values({
    code,
    // Namespaced so a media room can never be confused with anything else that
    // happens to share the server.
    livekitRoom: `lor_${code}`,
    hostSecretHash: secretHash,
    locale,
  });

  const store = await cookies();
  store.set(hostCookieName(code), cookieValue, hostCookieOptions());

  return NextResponse.json({ code }, { status: 201 });
}
