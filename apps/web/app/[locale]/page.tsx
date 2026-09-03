import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { LiveDot } from "@/components/ui/live-dot";

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
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-end gap-2 px-6 py-4">
        <ThemeToggle />
        <LocaleSwitcher />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-20">
        <div className="w-full max-w-xl">
          {/* The dot is part of the wordmark, not punctuation: it is the live
              indicator, so it takes the red the logo uses. <bdi> keeps it on
              the right of the letters when the page direction is RTL. */}
          <h1 className="text-2xl font-semibold tracking-tight">
            <bdi>
              LOR<span className="text-live">.</span>
            </bdi>
          </h1>

          <p className="mt-4 max-w-prose text-base text-balance">
            {t("tagline")}
          </p>

          {/* The line that says what this product is for better than a feature
              list would. dir="auto" picks the paragraph direction from the first
              strong character, and <bdi> isolates each Latin run so the
              surrounding Arabic does not scramble its word order. */}
          <p dir="auto" className="mt-3 max-w-prose text-base text-muted">
            {t.rich("codeSwitchExample", {
              term: (chunks) => (
                <bdi className="font-medium text-foreground">{chunks}</bdi>
              ),
            })}
          </p>

          <section className="mt-12 rounded-lg border border-border bg-surface p-6">
            <h2 className="sr-only">{t("roadmapHeading")}</h2>

            <ol className="space-y-2 text-sm">
              {RELEASES.map((release) => {
                const isCurrent = release.tag === CURRENT_RELEASE;
                return (
                  <li
                    key={release.tag}
                    className={
                      isCurrent
                        ? "flex items-center gap-4"
                        : "flex items-center gap-4 text-muted"
                    }
                  >
                    {/* Monospace here is not texture: these are values that
                        should align in a column. It is scoped to the tag
                        because no monospace face covers Arabic. */}
                    <span
                      dir="ltr"
                      className="w-14 shrink-0 font-mono text-xs tabular-nums"
                    >
                      {release.tag}
                    </span>
                    <span>{releases(release.key)}</span>
                    {isCurrent && (
                      <LiveDot
                        label={t("building")}
                        className="ms-auto text-xs"
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          <nav className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <a
              className="underline underline-offset-4 hover:text-muted"
              href={REPO}
            >
              {t("links.source")}
            </a>
            <a
              className="underline underline-offset-4 hover:text-muted"
              href={`${REPO}/milestones`}
            >
              {t("links.roadmap")}
            </a>
            <a
              className="underline underline-offset-4 hover:text-muted"
              href={`${REPO}/blob/main/CONTRIBUTING.md`}
            >
              {t("links.contributing")}
            </a>
            <span dir="ltr" className="text-muted">
              {t("links.license")}
            </span>
          </nav>
        </div>
      </main>
    </div>
  );
}
