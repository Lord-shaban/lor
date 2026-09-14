import type { Metadata } from "next";
import Image from "next/image";
import { use } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const REPO = "https://github.com/Lord-shaban/lor";
const LIVE_APP = "https://lor-bay.vercel.app";
const SETUP = `${REPO}#quick-start`;
const CONTAINER = "mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-10";
const TEXT_LINK =
  "underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });

  return {
    title: t("metadata.title"),
    description: t("metadata.description"),
    alternates: {
      languages: {
        ar: "/about",
        en: "/en/about",
        "x-default": "/about",
      },
    },
  };
}

export default function PublicLanding({
  params,
}: PageProps<"/[locale]/about">) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations("landing");

  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="border-b border-border">
        <div className={`${CONTAINER} py-4`}>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <Link
              href="/"
              aria-label="LOR."
              className="text-lg font-semibold tracking-tight"
            >
              <bdi>
                LOR<span className="text-live">.</span>
              </bdi>
            </Link>

            <nav
              aria-label={t("nav.label")}
              className="order-3 flex w-full items-center justify-center gap-5 text-sm text-muted sm:order-none sm:w-auto sm:justify-start"
            >
              <a className={TEXT_LINK} href="#story">
                {t("nav.story")}
              </a>
              <a className={TEXT_LINK} href="#open-source">
                {t("nav.openSource")}
              </a>
            </nav>

            <div className="flex items-center gap-3 sm:gap-4">
              <Button asChild size="sm" variant="outline">
                <a href={LIVE_APP}>{t("nav.try")}</a>
              </Button>
              <ThemeToggle />
              <LocaleSwitcher />
            </div>
          </div>
        </div>
      </header>

      <main>
        <section
          aria-labelledby="landing-title"
          className={`${CONTAINER} grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:py-28`}
        >
          <div className="max-w-xl">
            <p className="flex items-center gap-3 text-sm text-muted">
              <span className="h-px w-8 bg-border" aria-hidden="true" />
              {t("hero.kicker")}
            </p>

            <h1
              id="landing-title"
              className="mt-6 max-w-[12ch] text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
            >
              {t("hero.title")}
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-8 text-muted sm:text-xl">
              {t.rich("hero.description", {
                brand: (chunks) => <bdi className="text-foreground">{chunks}</bdi>,
              })}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <a href={LIVE_APP}>
                  {t("hero.liveCta")}
                  <ArrowUpRightIcon />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={REPO}>
                  {t("hero.sourceCta")}
                  <CodeIcon />
                </a>
              </Button>
            </div>

            <ul
              aria-label={t("hero.trustLabel")}
              className="mt-8 grid gap-2 text-sm text-muted sm:grid-cols-3 sm:gap-4"
            >
              <li>{t("hero.trust.noAccount")}</li>
              <li>{t("hero.trust.local")}</li>
              <li>
                {t.rich("hero.trust.ai", {
                  term: (chunks) => <bdi>{chunks}</bdi>,
                })}
              </li>
            </ul>
          </div>

          <figure className="min-w-0">
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
              <Image
                src="/landing/product-preview.svg"
                alt={t("hero.mediaAlt")}
                width={1440}
                height={900}
                priority
                sizes="(min-width: 1024px) 52vw, 100vw"
                className="h-auto w-full"
              />
            </div>
            <figcaption className="mt-4 flex flex-col gap-2 text-sm text-muted sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <span>{t("hero.mediaCaption")}</span>
              <details className="shrink-0">
                <summary className="cursor-pointer underline underline-offset-4">
                  {t("hero.mediaTextLabel")}
                </summary>
                <p className="mt-2 max-w-sm leading-6">{t("hero.mediaAlt")}</p>
              </details>
            </figcaption>
          </figure>
        </section>

        <section
          id="story"
          aria-labelledby="story-title"
          className="scroll-mt-8 border-y border-border bg-surface"
        >
          <div className={`${CONTAINER} py-16 sm:py-20 lg:py-24`}>
            <div className="max-w-2xl">
              <h2 id="story-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("story.title")}
              </h2>
              <p className="mt-5 text-base leading-7 text-muted sm:text-lg">
                {t("story.intro")}
              </p>
            </div>

            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-6 lg:gap-10">
              <StoryStep number="01" icon={<LinkIcon />} title={t("story.steps.join.title")}>
                {t.rich("story.steps.join.body", {
                  term: (chunks) => <bdi>{chunks}</bdi>,
                })}
              </StoryStep>
              <StoryStep number="02" icon={<TogetherIcon />} title={t("story.steps.together.title")}>
                {t.rich("story.steps.together.body", {
                  term: (chunks) => <bdi>{chunks}</bdi>,
                })}
              </StoryStep>
              <StoryStep number="03" icon={<EvidenceIcon />} title={t("story.steps.evidence.title")}>
                {t.rich("story.steps.evidence.body", {
                  term: (chunks) => <bdi>{chunks}</bdi>,
                })}
              </StoryStep>
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="proof-title"
          className={`${CONTAINER} grid gap-12 py-16 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-24`}
        >
          <div>
            <h2 id="proof-title" className="max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("proof.title")}
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-muted sm:text-lg">
              {t("proof.intro")}
            </p>
            <a className={`mt-6 inline-flex ${TEXT_LINK}`} href={`${REPO}/releases`}>
              {t("proof.releases")}
              <ArrowUpRightIcon />
            </a>
          </div>

          <ul className="divide-y divide-border border-y border-border">
            <ProofRow label={t("proof.rows.captions.label")}>
              {t("proof.rows.captions.body")}
            </ProofRow>
            <ProofRow label={t("proof.rows.collaboration.label")}>
              {t("proof.rows.collaboration.body")}
            </ProofRow>
            <ProofRow label={t("proof.rows.decisions.label")}>
              {t("proof.rows.decisions.body")}
            </ProofRow>
            <ProofRow label={t("proof.rows.search.label")}>
              {t("proof.rows.search.body")}
            </ProofRow>
          </ul>
        </section>

        <section
          id="open-source"
          aria-labelledby="open-source-title"
          className="scroll-mt-8 border-y border-border bg-surface"
        >
          <div className={`${CONTAINER} grid gap-10 py-16 sm:py-20 lg:grid-cols-[1fr_0.9fr] lg:items-start lg:gap-20 lg:py-24`}>
            <div>
              <p className="text-sm text-muted">AGPL-3.0</p>
              <h2 id="open-source-title" className="mt-4 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("openSource.title")}
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
                {t("openSource.body")}
              </p>
            </div>

            <div className="grid gap-3">
              <a
                href={REPO}
                className="group flex min-h-16 items-center justify-between gap-4 rounded-[var(--radius-md)] border border-border bg-background px-5 transition-colors duration-150 hover:bg-surface-strong"
              >
                <span>
                  <span className="block font-medium">{t("openSource.source")}</span>
                  <span className="mt-1 block text-sm text-muted">{t("openSource.sourceHint")}</span>
                </span>
                <ArrowUpRightIcon className="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
              </a>
              <a
                href={`${REPO}/blob/main/CONTRIBUTING.md`}
                className="group flex min-h-16 items-center justify-between gap-4 rounded-[var(--radius-md)] border border-border bg-background px-5 transition-colors duration-150 hover:bg-surface-strong"
              >
                <span>
                  <span className="block font-medium">{t("openSource.contribute")}</span>
                  <span className="mt-1 block text-sm text-muted">{t("openSource.contributeHint")}</span>
                </span>
                <ArrowUpRightIcon className="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
              </a>
              <a
                href={`${REPO}/milestones`}
                className="group flex min-h-16 items-center justify-between gap-4 rounded-[var(--radius-md)] border border-border bg-background px-5 transition-colors duration-150 hover:bg-surface-strong"
              >
                <span>
                  <span className="block font-medium">{t("openSource.roadmap")}</span>
                  <span className="mt-1 block text-sm text-muted">{t("openSource.roadmapHint")}</span>
                </span>
                <ArrowUpRightIcon className="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
              </a>
            </div>
          </div>
        </section>

        <section aria-labelledby="final-title" className={`${CONTAINER} py-16 sm:py-20 lg:py-24`}>
          <div className="rounded-[var(--radius-lg)] bg-foreground px-6 py-12 text-on-foreground sm:px-10 sm:py-16 lg:flex lg:items-end lg:justify-between lg:gap-12 lg:px-14">
            <div className="max-w-xl">
              <h2 id="final-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("final.title")}
              </h2>
              <p className="mt-4 text-base leading-7 opacity-75 sm:text-lg">
                {t("final.body")}
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:shrink-0">
              <a
                href={LIVE_APP}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-on-foreground px-6 text-base font-medium text-foreground transition-opacity duration-150 hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-foreground"
              >
                {t("final.liveCta")}
                <ArrowUpRightIcon />
              </a>
              <a
                href={REPO}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-on-foreground/40 px-6 text-base font-medium text-on-foreground transition-colors duration-150 hover:bg-on-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-foreground"
              >
                {t("final.sourceCta")}
                <CodeIcon />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className={`${CONTAINER} flex flex-col gap-5 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between`}>
          <p>
            {t.rich("footer.name", {
              brand: (chunks) => <bdi className="text-foreground">{chunks}</bdi>,
            })}
          </p>
          <nav aria-label={t("footer.label")} className="flex flex-wrap gap-x-5 gap-y-2">
            <a className={TEXT_LINK} href={SETUP}>
              {t("footer.setup")}
            </a>
            <a className={TEXT_LINK} href={`${REPO}/blob/main/SECURITY.md`}>
              {t("footer.security")}
            </a>
            <Link className={TEXT_LINK} href="/">
              {t("footer.product")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function StoryStep({
  number,
  icon,
  title,
  children,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="border-t border-border pt-5">
      <div className="flex items-center justify-between gap-4">
        <span dir="ltr" className="font-mono text-xs tabular-nums text-muted">
          {number}
        </span>
        <span className="text-muted" aria-hidden="true">
          {icon}
        </span>
      </div>
      <h3 className="mt-8 text-xl font-medium tracking-tight">{title}</h3>
      <p className="mt-3 text-base leading-7 text-muted">{children}</p>
    </li>
  );
}

function ProofRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="grid gap-2 py-5 sm:grid-cols-[minmax(9rem,0.45fr)_1fr] sm:gap-6">
      <span className="font-medium">{label}</span>
      <span className="text-base leading-7 text-muted">{children}</span>
    </li>
  );
}

function ArrowUpRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={`h-4 w-4 ${className}`}
    >
      <path d="M5.5 14.5 14.5 5.5M7 5.5h7.5V13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path d="m7.25 6-4 4 4 4M12.75 6l4 4-4 4M11.5 4.5l-3 11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
      <path d="m9.5 14.5 5-5M7.25 17.75l-1.5 1.5a3.18 3.18 0 0 1-4.5-4.5l3.5-3.5a3.18 3.18 0 0 1 4.5 0M16.75 6.25l1.5-1.5a3.18 3.18 0 1 1 4.5 4.5l-3.5 3.5a3.18 3.18 0 0 1-4.5 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TogetherIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <path d="M2.5 19c.6-3 2.4-4.5 5.5-4.5S12.9 16 13.5 19M10.5 19c.6-3 2.4-4.5 5.5-4.5s4.9 1.5 5.5 4.5" strokeLinecap="round" />
    </svg>
  );
}

function EvidenceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
      <path d="M5 4.5h14v15H5z" strokeLinejoin="round" />
      <path d="M8 9h8M8 12.5h6M8 16h4" strokeLinecap="round" />
      <path d="M8 4.5V3h8v1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
