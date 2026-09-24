import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { RoomLauncher } from "@/components/room-launcher";

const REPO = "https://github.com/Lord-shaban/lor";
const MENU_LINK_CLASS =
  "flex min-h-11 items-center rounded-sm px-3 py-2 text-sm text-foreground transition-colors duration-150 hover:bg-surface-strong focus-visible:bg-surface-strong";

export default function Home({ params }: PageProps<"/[locale]">) {
  // params is a promise in Next 16. This stays a sync Server Component so
  // useTranslations can run, so React unwraps the promise with use().
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations("home");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border px-6 py-4 sm:px-8">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <Link
            href="/"
            aria-label="LOR."
            className="text-lg font-semibold tracking-tight"
          >
            {/* The dot is part of the wordmark and the live indicator, not
                punctuation. <bdi> keeps it on the right in Arabic. */}
            <bdi>
              LOR<span className="text-live">.</span>
            </bdi>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <details className="group relative">
              <summary aria-label={t("links.menu")} className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-2 rounded-sm px-2 text-sm text-muted transition-colors duration-150 hover:bg-surface-strong hover:text-foreground">
                <HelpIcon />
                <span className="hidden sm:inline">{t("links.menu")}</span>
                <span className="hidden sm:block"><ChevronDownIcon /></span>
              </summary>

              <nav
                aria-label={t("links.menu")}
                className="absolute end-0 top-[calc(100%+0.5rem)] z-10 grid min-w-52 max-w-[calc(100vw-3rem)] overflow-hidden rounded-md border border-border bg-surface p-1"
              >
                <Link className={MENU_LINK_CLASS} href="/about">
                  {t("links.about")}
                </Link>
                <Link className={MENU_LINK_CLASS} href="/docs">
                  {t("links.docs")}
                </Link>
                <a className={MENU_LINK_CLASS} href={REPO}>
                  {t("links.source")}
                </a>
                <a className={MENU_LINK_CLASS} href={`${REPO}/blob/main/SECURITY.md`}>
                  {t("links.privacy")}
                </a>
                <a className={MENU_LINK_CLASS} href={`${REPO}/issues`}>
                  {t("links.help")}
                </a>
                <a className={MENU_LINK_CLASS} href={`${REPO}/blob/main/CONTRIBUTING.md`}>
                  {t("links.contributing")}
                </a>
                <a className={MENU_LINK_CLASS} href={`${REPO}/milestones`}>
                  {t("links.roadmap")}
                </a>
                <a className={MENU_LINK_CLASS} href={`${REPO}/blob/main/LICENSE`}>
                  <span dir="ltr">{t("links.license")}</span>
                </a>
              </nav>
            </details>
            <ThemeToggle />
            <LocaleSwitcher />
          </div>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-6 py-10 sm:px-8 sm:py-16 lg:items-center">
        <div className="w-full max-w-5xl">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {t("title")}
          </h1>

          <p className="mt-4 max-w-xl text-base text-balance">
            {t("tagline")}
          </p>

          <RoomLauncher />

          <ul
            aria-label={t("trust.label")}
            className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted"
          >
            <li>{t("trust.noAccount")}</li>
            <li>{t("trust.noDownload")}</li>
            <li>
              {t.rich("trust.worksWithoutAi", {
                term: (chunks) => <bdi>{chunks}</bdi>,
              })}
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}

function HelpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4 shrink-0">
      <circle cx="10" cy="10" r="7" />
      <path d="M8.25 7.5a2 2 0 1 1 3.25 1.6c-.9.7-1.5 1-1.5 2.15M10 14.5h.01" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-4 w-4 shrink-0 transition-transform duration-150 group-open:rotate-180"
    >
      <path d="m5.5 7.75 4.5 4.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
