import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { getDb, rooms } from "@lor/db";
import { CopyLink } from "@/components/copy-link";
import { LiveDot } from "@/components/ui/live-dot";
import { normalizeRoomCode } from "@/lib/room-code";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * A room.
 *
 * For now this confirms the room exists and hands over the invitation link.
 * The prejoin screen lands here in #13 and the call itself in #14.
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

  const t = await getTranslations({ locale, namespace: "room" });

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // getPathname applies the locale prefix rule, so the Arabic link stays short
  // — lor.dev/mza-krfq-tqn — while the English one carries /en.
  const path = getPathname({ href: `/${room.code}`, locale: locale as Locale });

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">
        <LiveDot label={t("ready")} pulse={false} className="text-muted" />

        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          {t("title")}
        </h1>

        <p className="mt-2 text-base text-muted">{t("shareToInvite")}</p>

        <div className="mt-6">
          <CopyLink url={`${origin}${path}`} />
        </div>

        <p className="mt-8 text-sm text-muted">{t("comingSoon")}</p>
      </div>
    </main>
  );
}
