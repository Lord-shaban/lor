import type { Metadata } from "next";
import { use } from "react";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DocumentationShell } from "@/components/documentation-shell";
import { LandingCopyCommand } from "@/components/landing-copy-command";

const TEXT_LINK =
  "inline-flex min-h-11 min-w-11 items-center underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground";
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

  const toc = ["start", "what", "workflow", "boundaries", "architecture", "quick-start", "contribute", "help"].map((id) => ({ id, label: id === "quick-start" ? t("quickStart.title") : t(`toc.${id}`) }));

  return (
    <DocumentationShell locale={locale} toc={toc}>
      <nav aria-label={t("breadcrumb.docs")} className="mb-7 flex items-center gap-2 text-sm text-muted">
        <Link className={TEXT_LINK} href="/about">{t("nav.product")}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-foreground">{t("breadcrumb.docs")}</span>
      </nav>
      <details className="group mb-8 border-y border-border xl:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">{t("toc.label")}<ChevronDownIcon className="transition-transform group-open:rotate-180" /></summary>
        <nav aria-label={t("toc.label")} className="grid gap-1 pb-3 sm:grid-cols-2">{toc.map((item) => <DocsNavLink key={item.id} href={`#${item.id}`}>{item.label}</DocsNavLink>)}</nav>
      </details>
            <article className="min-w-0 max-w-3xl">
              <section id="start" aria-labelledby="docs-title" className="scroll-mt-28">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                  <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted" aria-hidden="true" />
                    <span>{t("status")}</span>
                  </span>
                </div>
                <h1 id="docs-title" className="mt-6 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                  {t("title")}
                </h1>
                <p className="mt-6 max-w-3xl text-base leading-8 text-muted sm:text-lg">{t("intro")}</p>
                <nav aria-label={t("paths.label")} className="mt-10 grid gap-3 sm:grid-cols-3">
                  <DocsPath href="#workflow" title={t("paths.join.title")}>{t("paths.join.body")}</DocsPath>
                  <DocsPath href="#boundaries" title={t("paths.record.title")}>{t("paths.record.body")}</DocsPath>
                  <DocsPath href="#architecture" title={t("paths.build.title")}>{t("paths.build.body")}</DocsPath>
                </nav>
              </section>

              <section id="what" aria-labelledby="what-title" className="mt-12 scroll-mt-28 border-t border-border pt-10 sm:mt-16 sm:pt-12">
                <SectionIntro id="what-title" eyebrow={t("what.eyebrow")} title={t("what.title")}>
                  <p>{t("what.body")}</p>
                  <p className="mt-4">{t("what.mixed")}</p>
                  <Link className={`mt-6 inline-flex items-center gap-2 ${TEXT_LINK}`} href="/about">{t("what.linkLabel")}<ArrowUpRightIcon /></Link>
                </SectionIntro>
              </section>

              <section id="workflow" aria-labelledby="workflow-title" className="mt-12 scroll-mt-28 border-t border-border pt-10 sm:mt-16 sm:pt-12">
                <SectionIntro id="workflow-title" eyebrow={t("workflow.eyebrow")} title={t("workflow.title")}>
                  <p>{t("workflow.intro")}</p>
                </SectionIntro>
                <ol className="mt-8 grid gap-6">
                  <DocsStep number="01" title={t("workflow.steps.join.title")}><p>{t("workflow.steps.join.body")}</p></DocsStep>
                  <DocsStep number="02" title={t("workflow.steps.work.title")}><p>{t("workflow.steps.work.body")}</p></DocsStep>
                  <DocsStep number="03" title={t("workflow.steps.review.title")}><p>{t("workflow.steps.review.body")}</p></DocsStep>
                </ol>
              </section>

              <section id="boundaries" aria-labelledby="boundaries-title" className="mt-12 scroll-mt-28 border-t border-border pt-10 sm:mt-16 sm:pt-12">
                <SectionIntro id="boundaries-title" eyebrow={t("boundaries.eyebrow")} title={t("boundaries.title")}>
                  <p>{t("boundaries.intro")}</p>
                </SectionIntro>
                <div className="mt-10 hidden overflow-x-auto rounded-[var(--radius-lg)] border border-border lg:block">
                  <table className="w-full border-collapse text-start text-sm">
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
                <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:hidden">
                  {(["call", "evidence", "privacy", "extension"] as const).map((row) => (
                    <article key={row} className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
                      <h3 className="font-semibold">{t(`boundaries.rows.${row}.label`)}</h3>
                      <p className="mt-3 text-sm font-medium">{t("boundaries.today")}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">{t(`boundaries.rows.${row}.today`)}</p>
                      <p className="mt-4 text-sm font-medium">{t("boundaries.planned")}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">{t(`boundaries.rows.${row}.planned`)}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section id="architecture" aria-labelledby="architecture-title" className="mt-12 scroll-mt-28 border-t border-border pt-10 sm:mt-16 sm:pt-12">
                <SectionIntro id="architecture-title" eyebrow={t("architecture.eyebrow")} title={t("architecture.title")}>
                  <p>{t("architecture.intro")}</p>
                </SectionIntro>
                <ol className="mt-10 grid gap-3 sm:grid-cols-3">
                  {(["browser", "room", "record"] as const).map((step, index) => (
                    <li key={step} className="rounded-[var(--radius-md)] border border-border bg-surface p-5">
                      <span className="font-mono text-xs tabular-nums text-muted">0{index + 1}</span>
                      <h3 className="mt-4 font-semibold">{t(`architecture.flow.${step}.title`)}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted">{t(`architecture.flow.${step}.body`)}</p>
                    </li>
                  ))}
                </ol>
                <p className="mt-5 max-w-3xl text-base leading-7 text-muted">{t("architecture.note")}</p>
              </section>

              <section id="quick-start" aria-labelledby="quick-start-title" className="mt-12 scroll-mt-28 rounded-lg border border-border bg-surface p-5 sm:p-7">
                <p className="text-sm text-muted">{t("quickStart.eyebrow")}</p>
                <h2 id="quick-start-title" className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{t("quickStart.title")}</h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{t("quickStart.intro")}</p>
                <div className="mt-8 overflow-hidden rounded-[var(--radius-md)] border border-border bg-background text-foreground">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
                    <div><p className="text-sm font-medium">{t("quickStart.label")}</p><p className="mt-1 text-sm text-muted">{t("quickStart.hint")}</p></div>
                    <LandingCopyCommand value={QUICK_START} copyLabel={t("quickStart.copy")} copiedLabel={t("quickStart.copied")} />
                  </div>
                  <pre dir="ltr" className="overflow-x-auto p-5 text-start text-sm leading-7"><code>{QUICK_START}</code></pre>
                  <p className="border-t border-border px-5 py-4 text-sm leading-6 text-muted">{t("quickStart.note")}</p>
                </div>
              </section>

              <section id="contribute" aria-labelledby="contribute-title" className="mt-12 scroll-mt-28 border-t border-border pt-10 sm:mt-16 sm:pt-12">
                <SectionIntro id="contribute-title" eyebrow={t("contribute.eyebrow")} title={t("contribute.title")}>
                  <p>{t("contribute.body")}</p>
                </SectionIntro>
                <ol className="mt-10 grid gap-3">
                  <ContributeRow number="01">{t("contribute.steps.read")}</ContributeRow>
                  <ContributeRow number="02">{t("contribute.steps.choose")}</ContributeRow>
                  <ContributeRow number="03">{t("contribute.steps.verify")}</ContributeRow>
                </ol>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/resources/contributing" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-foreground px-5 text-sm font-medium text-on-foreground transition-opacity duration-150 hover:opacity-85">{t("contribute.cta")}<ArrowUpRightIcon /></Link>
                  <Link href="/resources/roadmap" className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border px-5 text-sm font-medium transition-colors duration-150 hover:bg-surface ${TEXT_LINK}`}>{t("contribute.roadmap")}<ArrowUpRightIcon /></Link>
                </div>
              </section>

              <section id="help" aria-labelledby="help-title" className="mt-12 scroll-mt-28 border-t border-border pt-10 sm:mt-16 sm:pt-12">
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

              <aside className="mt-12 border-t border-border pt-8 sm:mt-16">
                <h2 className="text-2xl font-semibold tracking-tight">{t("next.title")}</h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-muted">{t("next.body")}</p>
                <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm"><Link className={TEXT_LINK} href="/about">{t("next.project")}</Link><Link className={TEXT_LINK} href="/">{t("next.try")}</Link><Link className={TEXT_LINK} href="/resources/source">{t("next.source")}</Link></div>
              </aside>
            </article>
    </DocumentationShell>
  );
}
function SectionIntro({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return <div className="max-w-3xl"><p className="text-sm text-muted">{eyebrow}</p><h2 id={id} className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2><div className="mt-4 text-base leading-8 text-muted">{children}</div></div>;
}

function DocsNavLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} className="flex min-h-11 items-center rounded-sm px-3 text-sm text-muted transition-colors duration-150 hover:bg-surface hover:text-foreground focus-visible:bg-surface">{children}</a>;
}

function DocsPath({ href, title, children }: { href: string; title: string; children: ReactNode }) {
  return <a href={href} className="group flex flex-col gap-1 border-s-2 border-border ps-4 py-2 transition-colors duration-150 hover:border-foreground"><span className="font-semibold group-hover:underline group-hover:underline-offset-4">{title}</span><span className="text-sm leading-6 text-muted">{children}</span></a>;
}

function DocsStep({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4"><span dir="ltr" className="font-mono text-xs tabular-nums text-muted">{number}</span><h3 className="text-lg font-semibold tracking-tight">{title}</h3><div className="col-start-2 mt-2 text-base leading-7 text-muted">{children}</div></li>;
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

function ArrowUpRightIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4"><path d="M5.5 14.5 14.5 5.5M7 5.5h7.5V13" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ChevronDownIcon({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={`h-4 w-4 ${className}`}><path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
