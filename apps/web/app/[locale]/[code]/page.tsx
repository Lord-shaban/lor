import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { getDb, rooms } from "@lor/db";
import { RoomEntry } from "@/components/prejoin/room-entry";
import { normalizeRoomCode } from "@/lib/room-code";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * A room.
 *
 * The room is looked up server-side so a bad or unknown code 404s before any
 * device permission is requested. Everything after that — the prejoin screen
 * and, from #14, the call — is client-side.
 */
export default async function RoomPage({ params }: PageProps<"/[locale]/[code]">) {
  const { locale, code: rawCode } = await params;
  setRequestLocale(locale);

  // Someone may have typed the code by hand, or pasted it with the dashes in
  // the wrong places. Redirecting to the canonical form would be tidier, but a
  // room link is shared and forwarded, so accepting a variant silently is the
  // kinder behaviour.
  const code = normalizeRoomCode(rawCode);
  if (!code) notFound();

  const db = getDb();
  const [room] = await db
    .select({ code: rooms.code, locked: rooms.locked })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  if (!room) notFound();

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // getPathname applies the locale prefix rule, so the Arabic link stays short
  // — lor.dev/mza-krfq-tqn — while the English one carries /en.
  const path = getPathname({ href: `/${room.code}`, locale: locale as Locale });

  return (
    <main className="flex flex-1 justify-center px-6 py-12">
      <div className="w-full max-w-4xl">
        <RoomEntry code={room.code} inviteUrl={`${origin}${path}`} />
      </div>
    </main>
  );
}
