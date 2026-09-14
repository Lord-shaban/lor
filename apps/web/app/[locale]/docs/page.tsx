import type { Metadata } from "next";
import { use } from "react";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LandingCopyCommand } from "@/components/landing-copy-command";

const REPO = "https://github.com/Lord-shaban/lor";
const LIVE_APP = "https://lor-bay.vercel.app";
const CONTAINER = "mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-12";
const TEXT_LINK =
  "underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground";
const QUICK_START = `git clone https://github.com/Lord-shaban/lor && cd lor
cp .env.example .env.local
npm install && npm run dev`;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/docs">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "docs" });

  return {
    title: t("metadata.title"),
    description: t("metadata.description"),
    alternates: {
      languages: {
        ar: "/docs",
        en: "/en/docs",
        "x-default": "/docs",
      },
    },
  };
}

export default function DocsPage({ params }: PageProps<"/[locale]/docs">) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations("docs");

  return (
    <div className="min-h-full bg-background text-foreground">
      <a
        href="#docs-content"
        className="sr-only absolute start-4 top-4 z-50 rounded-sm bg-foreground px-4 py-3 text-on-foreground focus:not-sr-only"
      >
        {t("skip")}
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className={`${CONTAINER} py-4`}>
          <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr_auto]">
            <Link href="/" aria-label="LOR." className="justify-self-start">
              <LorWordmark className="h-9 w-auto" />
            </Link>
            <nav
              aria-label={t("nav.label")}
              className="order-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted sm:order-none sm:justify-start"
            >
              <Link className={TEXT_LINK} href="/about">{t("nav.product")}</Link>
              <span className="font-medium text-foreground">{t("nav.docs")}</span>
              <a className={TEXT_LINK} href={`${REPO}/discussions`}>{t("nav.community")}</a>
            </nav>
            <div className="flex items-center justify-self-end gap-2 sm:gap-3">
              <Button asChild size="sm"><a href={LIVE_APP}>{t("nav.try")}</a></Button>
              <ThemeToggle />
              <LocaleSwitcher />
            </div>
          </div>
        </div>
      </header>

      <main id="docs-content" tabIndex={-1}>
        <div className={`${CONTAINER} py-10 sm:py-14 lg:py-20`}>
          <nav aria-label={t("breadcrumb.docs")} className="flex items-center gap-2 text-sm text-muted">
            <Link className={TEXT_LINK} href="/">{t("breadcrumb.home")}</Link>
            <span aria-hidden="true">/</span>
            <span className="text-foreground">{t("breadcrumb.docs")}</span>
          </nav>

          <div className="mt-8 grid gap-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-20">
            <aside className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-sm font-medium">{t("toc.label")}</p>
              <nav aria-label={t("toc.label")} className="mt-4 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
                <DocsNavLink href="#start">{t("toc.start")}</DocsNavLink>
                <DocsNavLink href="#what">{t("toc.what")}</DocsNavLink>
                <DocsNavLink href="#workflow">{t("toc.workflow")}</DocsNavLink>
                <DocsNavLink href="#boundaries">{t("toc.boundaries")}</DocsNavLink>
                <DocsNavLink href="#architecture">{t("toc.architecture")}</DocsNavLink>
                <DocsNavLink href="#contribute">{t("toc.contribute")}</DocsNavLink>
                <DocsNavLink href="#help">{t("toc.help")}</DocsNavLink>
              </nav>
            </aside>

            <article className="min-w-0">
              <section id="start" aria-labelledby="docs-title" className="scroll-mt-28">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                  <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-live" aria-hidden="true" />
                    <span>{t("status")}</span>
                  </span>
                </div>
                <h1 id="docs-title" className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.06] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
                  {t("title")}
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-muted sm:text-xl">{t("intro")}</p>
              </section>

              <section aria-labelledby="quick-start-title" className="mt-14 scroll-mt-28 rounded-[var(--radius-lg)] bg-foreground p-6 text-on-foreground sm:p-8">
                <p className="text-sm opacity-65">{t("quickStart.eyebrow")}</p>
                <div className="mt-3 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
                  <div className="max-w-2xl">
                    <h2 id="quick-start-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("quickStart.title")}</h2>
                    <p className="mt-4 text-base leading-7 opacity-75">{t("quickStart.intro")}</p>
                  </div>
                  <Link href="#architecture" className="inline-flex shrink-0 items-center gap-2 text-sm underline underline-offset-4 decoration-on-foreground/40 hover:decoration-on-foreground">
                    {t("quickStart.details")}<ArrowDownIcon />
                  </Link>
                </div>
                <div className="mt-8 overflow-hidden rounded-[var(--radius-md)] border border-on-foreground/20 bg-background text-foreground">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
                    <div><p className="text-sm font-medium">{t("quickStart.label")}</p><p className="mt-1 text-sm text-muted">{t("quickStart.hint")}</p></div>
                    <LandingCopyCommand value={QUICK_START} copyLabel={t("quickStart.copy")} copiedLabel={t("quickStart.copied")} />
                  </div>
                  <pre className="overflow-x-auto p-5 text-sm leading-7"><code>{QUICK_START}</code></pre>
                  <p className="border-t border-border px-5 py-4 text-sm leading-6 text-muted">{t("quickStart.note")}</p>
                </div>
              </section>

              <section id="what" aria-labelledby="what-title" className="mt-20 scroll-mt-28 border-t border-border pt-14 sm:mt-24 sm:pt-20">
                <SectionIntro id="what-title" eyebrow={t("what.eyebrow")} title={t("what.title")}>
                  <p>{t("what.body")}</p>
                  <p className="mt-4">{t("what.mixed")}</p>
                  <Link className={`mt-6 inline-flex items-center gap-2 ${TEXT_LINK}`} href="/about">{t("what.linkLabel")}<ArrowUpRightIcon /></Link>
                </SectionIntro>
              </section>

              <section id="workflow" aria-labelledby="workflow-title" className="mt-20 scroll-mt-28 border-t border-border pt-14 sm:mt-24 sm:pt-20">
                <SectionIntro id="workflow-title" eyebrow={t("workflow.eyebrow")} title={t("workflow.title")}>
                  <p>{t("workflow.intro")}</p>
                </SectionIntro>
                <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
                  <DocsStep number="01" title={t("workflow.steps.join.title")}><p>{t("workflow.steps.join.body")}</p></DocsStep>
                  <DocsStep number="02" title={t("workflow.steps.work.title")}><p>{t("workflow.steps.work.body")}</p></DocsStep>
                  <DocsStep number="03" title={t("workflow.steps.review.title")}><p>{t("workflow.steps.review.body")}</p></DocsStep>
                </ol>
              </section>

              <section id="boundaries" aria-labelledby="boundaries-title" className="mt-20 scroll-mt-28 border-t border-border pt-14 sm:mt-24 sm:pt-20">
                <SectionIntro id="boundaries-title" eyebrow={t("boundaries.eyebrow")} title={t("boundaries.title")}>
                  <p>{t("boundaries.intro")}</p>
                </SectionIntro>
                <div className="mt-10 overflow-x-auto rounded-[var(--radius-lg)] border border-border">
                  <table className="w-full min-w-[48rem] border-collapse text-start text-sm">
                    <caption className="sr-only">{t("boundaries.caption")}</caption>
                    <thead className="bg-surface"><tr className="border-b border-border"><th scope="col" className="w-[25%] px-5 py-4 font-medium">{t("boundaries.capability")}</th><th scope="col" className="w-[37.5%] px-5 py-4 font-medium">{t("boundaries.today")}</th><th scope="col" className="w-[37.5%] px-5 py-4 font-medium text-muted">{t("boundaries.planned")}</th></tr></thead>
                    <tbody className="divide-y divide-border">
                      <BoundaryRow label={t("boundaries.rows.call.label")} today={t("boundaries.rows.call.today")} planned={t("boundaries.rows.call.planned")} />
                      <BoundaryRow label={t("boundaries.rows.evidence.label")} today={t("boundaries.rows.evidence.today")} planned={t("boundaries.rows.evidence.planned")} />
                      <BoundaryRow label={t("boundaries.rows.privacy.label")} today={t("boundaries.rows.privacy.today")} planned={t("boundaries.rows.privacy.planned")} />
                      <BoundaryRow label={t("boundaries.rows.extension.label")} today={t("boundaries.rows.extension.today")} planned={t("boundaries.rows.extension.planned")} />
                    </tbody>
                  </table>
                </div>
              </section>

              <section id="architecture" aria-labelledby="architecture-title" className="mt-20 scroll-mt-28 border-t border-border pt-14 sm:mt-24 sm:pt-20">
                <SectionIntro id="architecture-title" eyebrow={t("architecture.eyebrow")} title={t("architecture.title")}>
                  <p>{t("architecture.intro")}</p>
                </SectionIntro>
                <pre dir="ltr" className="mt-10 overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-surface p-5 text-xs leading-7 text-foreground sm:p-7 sm:text-sm"><code>{t("architecture.code")}</code></pre>
                <p className="mt-5 max-w-3xl text-base leading-7 text-muted">{t("architecture.note")}</p>
              </section>

              <section id="contribute" aria-labelledby="contribute-title" className="mt-20 scroll-mt-28 border-t border-border pt-14 sm:mt-24 sm:pt-20">
                <SectionIntro id="contribute-title" eyebrow={t("contribute.eyebrow")} title={t("contribute.title")}>
                  <p>{t("contribute.body")}</p>
                </SectionIntro>
                <ol className="mt-10 grid gap-3">
                  <ContributeRow number="01">{t("contribute.steps.read")}</ContributeRow>
                  <ContributeRow number="02">{t("contribute.steps.choose")}</ContributeRow>
                  <ContributeRow number="03">{t("contribute.steps.verify")}</ContributeRow>
                </ol>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a href={`${REPO}/blob/main/CONTRIBUTING.md`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-foreground px-5 text-sm font-medium text-on-foreground transition-opacity duration-150 hover:opacity-85">{t("contribute.cta")}<ArrowUpRightIcon /></a>
                  <a href={`${REPO}/blob/main/docs/open-source.md`} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border px-5 text-sm font-medium transition-colors duration-150 hover:bg-surface ${TEXT_LINK}`}>{t("contribute.roadmap")}<ArrowUpRightIcon /></a>
                </div>
              </section>

              <section id="help" aria-labelledby="help-title" className="mt-20 scroll-mt-28 border-t border-border pt-14 sm:mt-24 sm:pt-20">
                <SectionIntro id="help-title" eyebrow={t("help.eyebrow")} title={t("help.title")}>
                  <p>{t("help.intro")}</p>
                </SectionIntro>
                <div className="mt-10 divide-y divide-border border-y border-border">
                  <DocsFaq question={t("help.items.keys.question")}><p>{t("help.items.keys.answer")}</p></DocsFaq>
                  <DocsFaq question={t("help.items.ai.question")}><p>{t("help.items.ai.answer")}</p></DocsFaq>
                  <DocsFaq question={t("help.items.selfHost.question")}><p>{t("help.items.selfHost.answer")}</p></DocsFaq>
                  <DocsFaq question={t("help.items.language.question")}><p>{t("help.items.language.answer")}</p></DocsFaq>
                </div>
              </section>

              <aside className="mt-20 rounded-[var(--radius-lg)] border border-border bg-surface p-6 sm:mt-24 sm:p-8">
                <h2 className="text-2xl font-semibold tracking-tight">{t("next.title")}</h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-muted">{t("next.body")}</p>
                <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm"><Link className={TEXT_LINK} href="/about">{t("next.project")}</Link><a className={TEXT_LINK} href={LIVE_APP}>{t("next.try")}</a><a className={TEXT_LINK} href={REPO}>{t("next.source")}</a></div>
              </aside>
            </article>
          </div>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className={`${CONTAINER} flex flex-col gap-6 py-9 text-sm text-muted sm:flex-row sm:items-start sm:justify-between`}>
          <div><div className="flex items-center gap-3"><LorWordmark className="h-7 w-auto" /><span>{t("footer.license")}</span></div><p className="mt-3 max-w-sm leading-6">{t("footer.tagline")}</p></div>
          <nav aria-label={t("footer.label")} className="grid grid-cols-2 gap-x-8 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-6"><Link className={TEXT_LINK} href="/about">{t("footer.landing")}</Link><Link className={TEXT_LINK} href="/">{t("footer.product")}</Link><a className={TEXT_LINK} href={`${REPO}/blob/main/SECURITY.md`}>{t("footer.security")}</a><a className={TEXT_LINK} href={REPO}>{t("footer.source")}</a></nav>
        </div>
      </footer>
    </div>
  );
}

function SectionIntro({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return <div className="max-w-3xl"><p className="text-sm text-muted">{eyebrow}</p><h2 id={id} className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2><div className="mt-5 text-base leading-7 text-muted sm:text-lg">{children}</div></div>;
}

function DocsNavLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} className="flex min-h-11 items-center rounded-sm px-3 text-sm text-muted transition-colors duration-150 hover:bg-surface hover:text-foreground focus-visible:bg-surface">{children}</a>;
}

function DocsStep({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <li className="border-t border-border pt-5"><span dir="ltr" className="font-mono text-xs tabular-nums text-muted">{number}</span><h3 className="mt-7 text-xl font-medium tracking-tight">{title}</h3><div className="mt-3 text-base leading-7 text-muted">{children}</div></li>;
}

function BoundaryRow({ label, today, planned }: { label: string; today: string; planned: string }) {
  return <tr><th scope="row" className="px-5 py-5 text-start font-medium">{label}</th><td className="px-5 py-5">{today}</td><td className="px-5 py-5 text-muted">{planned}</td></tr>;
}

function ContributeRow({ number, children }: { number: string; children: ReactNode }) {
  return <li className="flex items-start gap-4 rounded-[var(--radius-md)] border border-border bg-surface px-5 py-4"><span dir="ltr" className="mt-0.5 font-mono text-xs tabular-nums text-muted">{number}</span><span className="text-base leading-6">{children}</span></li>;
}

function DocsFaq({ question, children }: { question: string; children: ReactNode }) {
  return <details className="group"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-5 text-start font-medium [&::-webkit-details-marker]:hidden"><span>{question}</span><ChevronDownIcon className="shrink-0 text-muted transition-transform duration-150 group-open:rotate-180" /></summary><div className="max-w-3xl pb-6 pe-8 text-base leading-7 text-muted">{children}</div></details>;
}

function LorWordmark({ className = "" }: { className?: string }) {
  return <svg role="img" aria-label="LOR." viewBox="0 0 360 140" fill="none" className={className}><title>LOR.</title><g stroke="currentColor" strokeWidth="20" strokeLinecap="butt" strokeLinejoin="round"><path d="M10 20V110H60" /><circle cx="136" cy="70" r="40" /><path d="M222 20V120M222 30H256A25 25 0 0 1 256 80H222M222 80L301 110" /></g><circle cx="332" cy="105" r="15" fill="var(--live)" /></svg>;
}

function ArrowUpRightIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4"><path d="M5.5 14.5 14.5 5.5M7 5.5h7.5V13" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ArrowDownIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4"><path d="M10 4v12m0 0-4-4m4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ChevronDownIcon({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={`h-4 w-4 ${className}`}><path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
