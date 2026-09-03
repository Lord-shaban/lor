import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";

const REPO = "https://github.com/Lord-shaban/lor";

/** The release being built. Everything before it is done, everything after is planned. */
const CURRENT_RELEASE = "v0.0";

/** Message key per release, so the names translate with everything else. */
const RELEASES = [
  { tag: "v0.0", key: "v0_0" },
  { tag: "v0.1", key: "v0_1" },
  { tag: "v0.1.5", key: "v0_1_5" },
  { tag: "v0.1.8", key: "v0_1_8" },
  { tag: "v0.2", key: "v0_2" },
  { tag: "v0.3", key: "v0_3" },
  { tag: "v0.4", key: "v0_4" },
  { tag: "v0.5", key: "v0_5" },
  { tag: "v0.6", key: "v0_6" },
  { tag: "v0.7", key: "v0_7" },
  { tag: "v0.8", key: "v0_8" },
  { tag: "v1.0", key: "v1_0" },
] as const;

export default function Home({ params }: PageProps<"/[locale]">) {
  // params is a promise in Next 16. This stays a sync Server Component so
  // useTranslations can run, so React unwraps the promise with use().
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations("home");
  const releases = useTranslations("releases");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">
        <div className="flex items-start justify-between gap-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] opacity-50">
            {t("eyebrow")}
          </p>
          <LocaleSwitcher />
        </div>

        {/* The dot is part of the wordmark, not punctuation: it is the live
            indicator, so it takes the red the logo uses. <bdi> keeps it on the
            right of the letters when the page direction is RTL. */}
        <h1 className="mt-3 text-5xl font-semibold tracking-tight">
          <bdi>
            LOR<span className="text-red-500">.</span>
          </bdi>
        </h1>

        <p className="mt-4 text-lg text-balance opacity-80">{t("tagline")}</p>

        {/* dir="auto" lets the browser pick the paragraph direction from the
            first strong character, and <bdi> isolates each Latin run so the
            surrounding Arabic does not scramble its word order. */}
        <p dir="auto" className="mt-2 text-lg text-balance opacity-80">
          {t.rich("codeSwitchExample", {
            term: (chunks) => <bdi className="font-medium">{chunks}</bdi>,
          })}
        </p>

        <div className="mt-10 rounded-lg border border-current/15 p-5">
          <p className="text-sm">
            {t.rich("status", {
              version: (chunks) => (
                <span className="font-mono font-medium">{chunks}</span>
              ),
            })}
          </p>

          {/* Monospace suits the version tags, but no mono face covers Arabic, so
              the release names would drop to an unrelated system fallback. The
              tags keep mono; the names use the sans stack. */}
          <ol className="mt-5 space-y-1.5 text-xs">
            {RELEASES.map((release) => {
              const isCurrent = release.tag === CURRENT_RELEASE;
              return (
                <li
                  key={release.tag}
                  className={isCurrent ? "flex gap-3" : "flex gap-3 opacity-45"}
                >
                  <span
                    dir="ltr"
                    className="w-14 shrink-0 font-mono tabular-nums"
                  >
                    {release.tag}
                  </span>
                  <span>{releases(release.key)}</span>
                  {isCurrent && (
                    <span className="ms-auto opacity-60">{t("building")}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <a className="underline underline-offset-4" href={REPO}>
            {t("links.source")}
          </a>
          <a
            className="underline underline-offset-4"
            href={`${REPO}/milestones`}
          >
            {t("links.roadmap")}
          </a>
          <a
            className="underline underline-offset-4"
            href={`${REPO}/blob/main/CONTRIBUTING.md`}
          >
            {t("links.contributing")}
          </a>
          <span dir="ltr" className="opacity-50">
            {t("links.license")}
          </span>
        </div>
      </div>
    </main>
  );
}
