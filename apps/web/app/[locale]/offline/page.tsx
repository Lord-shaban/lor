import { getTranslations, setRequestLocale } from "next-intl/server";

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
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-3 text-base text-muted">{t("body")}</p>
      </div>
    </main>
  );
}
