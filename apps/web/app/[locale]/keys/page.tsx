import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { GUIDE, hours } from "@/lib/keys/guide";
import { PROVIDERS } from "@/lib/stt/providers";

/**
 * Where a key comes from.
 *
 * The quota message ends with "add your own key", and between that sentence
 * and somebody actually doing it sits a search, three marketing pages, and a
 * signup flow with the pricing on another tab. Most people stop there. This
 * page is that gap: is there a free tier, how much, does it want a card, and
 * where in their console the key actually is — the same four questions in the
 * same order, so two providers can be compared by looking rather than reading.
 *
 * Static and server-rendered on purpose. It has to work when the operator has
 * configured no key at all, which is exactly the deployment where somebody
 * needs it most.
 */
export default async function KeysPage({ params }: PageProps<"/[locale]/keys">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "keys" });

  const formatter = new Intl.NumberFormat(locale);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:px-8 sm:py-12">
      <div className="grid items-start gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16">
        <header className="lg:sticky lg:top-10">
          <Link href="/" className="inline-flex min-h-11 items-center text-sm text-muted underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground">
            {t("backHome")}
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-4 max-w-prose text-base leading-7 text-muted">{t("intro")}</p>
          <p className="mt-8 border-t border-border pt-6 text-sm leading-6 text-muted">{t("howToAdd")}</p>
        </header>

        <div className="flex min-w-0 flex-col gap-5">
        {GUIDE.map((entry) => {
          const provider = PROVIDERS[entry.id];
          if (!provider) return null;

          return (
            <section
              key={entry.id}
              className="rounded-lg border border-border bg-surface p-5 sm:p-6"
            >
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-medium">
                  {/* A product name inside interface text: the run is isolated,
                      and only the run. */}
                  <bdi>{provider.label}</bdi>
                </h2>
                {/* The date is isolated and the label is not. An ISO date is
                    a Latin-script run inside Arabic interface text, and left
                    to itself it reorders — this rendered as 05-09-2026 before
                    the isolate, which is a different and entirely plausible
                    date. The repository's rule: isolate the foreign run, never
                    the run together with the words around it. */}
                <span className="text-xs text-muted">
                  {t.rich("checked", {
                    date: entry.checkedOn,
                    d: (chunks) => <bdi>{chunks}</bdi>,
                  })}
                </span>
              </header>

              <dl className="mt-5 grid gap-x-8 gap-y-5 border-t border-border pt-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-muted">{t("freeTier")}</dt>
                  <dd className="mt-0.5 text-sm">
                    {entry.free
                      ? t("freeYes", {
                          hours: hours(entry.free.secondsPerDay ?? 0),
                        })
                      : t("freeNo")}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium text-muted">{t("limits")}</dt>
                  <dd className="mt-0.5 text-sm">
                    {entry.free?.secondsPerHour
                      ? t("limitsDetail", {
                          hoursPerHour: hours(entry.free.secondsPerHour),
                          requests: formatter.format(entry.free.requestsPerMinute ?? 0),
                        })
                      : entry.paidPerMinuteUsd !== null
                        ? t("paidRate", { usd: entry.paidPerMinuteUsd })
                        : t("unstated")}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium text-muted">{t("card")}</dt>
                  <dd className="mt-0.5 text-sm">{t(`card_${entry.card}`)}</dd>
                </div>

                <div>
                  <dt className="text-xs font-medium text-muted">{t("audioPath")}</dt>
                  <dd className="mt-0.5 text-sm">
                    {provider.browserDirect
                      ? t("pathDirect")
                      : entry.directTested
                        ? t("pathProxy")
                        : t("pathUntested")}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-5 text-sm">
                {/* Straight into their console. Never an affiliate or referral
                    link — the moment a recommendation pays us it stops being
                    one, and this page is only worth anything if it is trusted. */}
                <a
                  href={entry.keysUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-4"
                >
                  {t("getKey")}
                </a>
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted underline underline-offset-4"
                >
                  {t("source")}
                </a>
              </div>
            </section>
          );
        })}
          <p className="max-w-prose text-xs leading-5 text-muted">{t("noAffiliates")}</p>
        </div>
      </div>
    </main>
  );
}
