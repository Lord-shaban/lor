import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * What an installed app shows when a navigation has nowhere to go.
 *
 * Deliberately static and deliberately dull. It is the only page the service
 * worker keeps, so it must not imply anything about a room, a meeting, or
 * whether anybody is waiting — all of which it cannot know.
 */
export default async function OfflinePage({
  params,
}: PageProps<"/[locale]/offline">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "offline" });

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface px-6 py-10 text-center sm:px-10">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mx-auto mt-4 max-w-prose text-base leading-7 text-muted">{t("body")}</p>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-5 text-sm font-medium text-on-foreground hover:opacity-90">
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
