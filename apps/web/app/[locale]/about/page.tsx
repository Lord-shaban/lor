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
import { LandingMeetingShowcase } from "@/components/landing-meeting-showcase";
import {
  BoardIcon,
  CheckIcon,
  RecordIcon,
  SearchIcon,
  ShieldIcon,
} from "@/components/landing-icons";

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
      <a
        href="#main-content"
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
              <a className={TEXT_LINK} href="#product">
                {t("nav.product")}
              </a>
              <a className={TEXT_LINK} href="#features">
                {t("nav.features")}
              </a>
              <Link className={TEXT_LINK} href="/docs">
                {t("nav.docs")}
              </Link>
              <a className={TEXT_LINK} href="#compare">
                {t("nav.compare")}
              </a>
            </nav>

            <div className="flex items-center justify-self-end gap-2 sm:gap-3">
              <Button asChild size="sm">
                <a href={LIVE_APP}>{t("nav.try")}</a>
              </Button>
              <ThemeToggle />
              <LocaleSwitcher />
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section
          aria-labelledby="landing-title"
          className="overflow-hidden border-b border-border"
        >
          <div
            className={`${CONTAINER} grid gap-12 py-14 sm:py-20 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:gap-16 lg:py-20`}
          >
            <div className="max-w-2xl">
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-md border border-border bg-surface text-foreground">
                  <LorMark />
                </span>
                <div>
                  <p className="text-sm font-medium tracking-tight">{t("brand.name")}</p>
                  <p className="mt-1 text-sm text-muted">{t("brand.tagline")}</p>
                </div>
              </div>

              <p className="mt-10 text-sm text-muted">
                {t("hero.kicker")}
              </p>

              <h1
                id="landing-title"
                className="mt-5 max-w-[15ch] text-4xl font-semibold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl"
              >
                {t("hero.title")}
              </h1>

              <p className="mt-7 max-w-xl text-lg leading-8 text-muted sm:text-xl">
                {t.rich("hero.description", {
                  brand: (chunks) => (
                    <bdi className="font-medium text-foreground">{chunks}</bdi>
                  ),
                })}
              </p>

              <p className="mt-4 max-w-xl text-base leading-7 text-muted">
                {t("hero.supporting")}
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild size="lg">
                  <a href={LIVE_APP}>
                    {t("hero.liveCta")}
                    <ArrowUpRightIcon />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/docs">
                    {t("hero.docsCta")}
                    <BookIcon />
                  </Link>
                </Button>
              </div>

              <p className="mt-5 text-sm text-muted">
                {t("hero.sourceLead")} {" "}
                <a className={TEXT_LINK} href={REPO}>
                  {t("hero.sourceCta")}
                </a>
              </p>

              <ul
                aria-label={t("hero.trustLabel")}
                className="mt-9 grid gap-3 border-y border-border py-4 text-sm text-muted sm:grid-cols-3 sm:gap-5"
              >
                <li className="flex items-start gap-2">
                  <CheckIcon />
                  <span>{t("hero.trust.noAccount")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckIcon />
                  <span>{t("hero.trust.local")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckIcon />
                  <span>
                    {t.rich("hero.trust.ai", {
                      term: (chunks) => <bdi>{chunks}</bdi>,
                    })}
                  </span>
                </li>
              </ul>
            </div>

            <LandingMeetingShowcase />
          </div>
        </section>

        <section id="product" aria-labelledby="product-title" className="scroll-mt-24 bg-surface">
          <div className={`${CONTAINER} grid gap-8 py-16 sm:py-20 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-start lg:gap-20 lg:py-24`}>
            <div>
              <p className="text-sm text-muted">{t("gallery.eyebrow")}</p>
              <h2 id="product-title" className="mt-4 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">{t("gallery.title")}</h2>
            </div>
            <div>
              <p className="max-w-2xl text-lg leading-8 text-muted">{t("gallery.intro")}</p>
              <div className="mt-8 grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
                <p className="text-sm leading-6">{t("gallery.home.body")}</p>
                <p className="text-sm leading-6">{t("gallery.menu.body")}</p>
                <p className="text-sm leading-6">{t("gallery.workspace.body")}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="story" aria-labelledby="story-title" className="scroll-mt-24 border-y border-border">
          <div className={`${CONTAINER} py-16 sm:py-20 lg:py-28`}>
            <div className="max-w-2xl">
              <p className="text-sm text-muted">{t("story.eyebrow")}</p>
              <h2 id="story-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("story.title")}
              </h2>
              <p className="mt-5 text-base leading-7 text-muted sm:text-lg">{t("story.intro")}</p>
            </div>

            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-7 lg:gap-12">
              <StoryStep number="01" icon={<LinkIcon />} title={t("story.steps.join.title")}>
                {t.rich("story.steps.join.body", { term: (chunks) => <bdi>{chunks}</bdi> })}
              </StoryStep>
              <StoryStep number="02" icon={<TogetherIcon />} title={t("story.steps.together.title")}>
                {t.rich("story.steps.together.body", { term: (chunks) => <bdi>{chunks}</bdi> })}
              </StoryStep>
              <StoryStep number="03" icon={<EvidenceIcon />} title={t("story.steps.evidence.title")}>
                {t.rich("story.steps.evidence.body", { term: (chunks) => <bdi>{chunks}</bdi> })}
              </StoryStep>
            </ol>
          </div>
        </section>

        <section id="features" aria-labelledby="features-title" className="scroll-mt-24">
          <div className={`${CONTAINER} py-16 sm:py-20 lg:py-28`}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
              <div className="max-w-2xl">
                <p className="text-sm text-muted">{t("features.eyebrow")}</p>
                <h2 id="features-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {t("features.title")}
                </h2>
              </div>
              <p className="max-w-xl text-base leading-7 text-muted sm:text-lg">{t("features.intro")}</p>
            </div>

            <div className="mt-12 grid gap-px overflow-hidden border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard icon={<CaptionIcon />} title={t("features.cards.captions.title")}>{t("features.cards.captions.body")}</FeatureCard>
              <FeatureCard icon={<BoardIcon />} title={t("features.cards.collaboration.title")}>{t("features.cards.collaboration.body")}</FeatureCard>
              <FeatureCard icon={<RecordIcon />} title={t("features.cards.recording.title")}>{t("features.cards.recording.body")}</FeatureCard>
              <FeatureCard icon={<EvidenceIcon />} title={t("features.cards.decisions.title")}>{t("features.cards.decisions.body")}</FeatureCard>
              <FeatureCard icon={<TimelineIcon />} title={t("features.cards.timeline.title")}>{t("features.cards.timeline.body")}</FeatureCard>
              <FeatureCard icon={<SearchIcon />} title={t("features.cards.search.title")}>{t("features.cards.search.body")}</FeatureCard>
            </div>
          </div>
        </section>

        <section id="compare" aria-labelledby="compare-title" className="scroll-mt-24 border-y border-border bg-surface">
          <div className={`${CONTAINER} py-16 sm:py-20 lg:py-28`}>
            <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-end lg:gap-20">
              <div>
                <p className="text-sm text-muted">{t("compare.eyebrow")}</p>
                <h2 id="compare-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("compare.title")}</h2>
              </div>
              <p className="max-w-2xl text-base leading-7 text-muted sm:text-lg">{t("compare.intro")}</p>
            </div>

            <div className="mt-12 overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-background">
              <table className="w-full min-w-[42rem] border-collapse text-start text-sm">
                <caption className="sr-only">{t("compare.caption")}</caption>
                <thead className="bg-surface">
                  <tr className="border-b border-border">
                    <th scope="col" className="w-[34%] px-5 py-4 font-medium">{t("compare.capability")}</th>
                    <th scope="col" className="w-[33%] px-5 py-4 font-medium text-muted">{t("compare.baseline")}</th>
                    <th scope="col" className="w-[33%] px-5 py-4 font-semibold">{t("compare.lor")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <ComparisonRow label={t("compare.rows.join.label")} baseline={t("compare.rows.join.baseline")} lor={t("compare.rows.join.lor")} />
                  <ComparisonRow label={t("compare.rows.collaboration.label")} baseline={t("compare.rows.collaboration.baseline")} lor={t("compare.rows.collaboration.lor")} />
                  <ComparisonRow label={t("compare.rows.captions.label")} baseline={t("compare.rows.captions.baseline")} lor={t("compare.rows.captions.lor")} />
                  <ComparisonRow label={t("compare.rows.record.label")} baseline={t("compare.rows.record.baseline")} lor={t("compare.rows.record.lor")} />
                  <ComparisonRow label={t("compare.rows.evidence.label")} baseline={t("compare.rows.evidence.baseline")} lor={t("compare.rows.evidence.lor")} />
                  <ComparisonRow label={t("compare.rows.search.label")} baseline={t("compare.rows.search.baseline")} lor={t("compare.rows.search.lor")} />
                  <ComparisonRow label={t("compare.rows.ai.label")} baseline={t("compare.rows.ai.baseline")} lor={t("compare.rows.ai.lor")} />
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">{t("compare.note")}</p>
          </div>
        </section>

        <section aria-labelledby="docs-cta-title" className="border-b border-border bg-foreground text-on-foreground">
          <div className={`${CONTAINER} grid gap-10 py-16 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-20 lg:py-24`}>
            <div className="max-w-xl">
              <p className="text-sm opacity-65">{t("docsCta.eyebrow")}</p>
              <h2 id="docs-cta-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("docsCta.title")}</h2>
              <p className="mt-5 text-base leading-7 opacity-75 sm:text-lg">{t("docsCta.body")}</p>
              <Button asChild size="lg" variant="secondary" className="mt-8">
                <Link href="/docs">{t("docsCta.cta")}<ArrowUpRightIcon /></Link>
              </Button>
            </div>

            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-on-foreground/20 bg-background text-foreground">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
                <div>
                  <p className="text-sm font-medium">{t("quickStart.label")}</p>
                  <p className="mt-1 text-sm text-muted">{t("quickStart.hint")}</p>
                </div>
                <LandingCopyCommand value={QUICK_START} copyLabel={t("quickStart.copy")} copiedLabel={t("quickStart.copied")} />
              </div>
              <pre className="overflow-x-auto p-5 text-sm leading-7 sm:p-6"><code>{QUICK_START}</code></pre>
              <div className="border-t border-border px-5 py-4 text-sm text-muted sm:px-6">{t("quickStart.note")}</div>
            </div>
          </div>
        </section>

        <section aria-labelledby="control-title" className="border-b border-border bg-surface">
          <div className={`${CONTAINER} py-16 sm:py-20 lg:py-28`}>
            <div className="max-w-2xl">
              <p className="text-sm text-muted">{t("control.eyebrow")}</p>
              <h2 id="control-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("control.title")}</h2>
              <p className="mt-5 text-base leading-7 text-muted sm:text-lg">{t("control.intro")}</p>
            </div>

            <div className="mt-12 grid gap-px overflow-hidden border border-border bg-border md:grid-cols-3">
              <GuardrailCard icon={<ShieldIcon />} title={t("control.cards.scope.title")}>{t("control.cards.scope.body")}</GuardrailCard>
              <GuardrailCard icon={<RecordIcon />} title={t("control.cards.local.title")}>{t("control.cards.local.body")}</GuardrailCard>
              <GuardrailCard icon={<CodeIcon />} title={t("control.cards.keys.title")}>{t("control.cards.keys.body")}</GuardrailCard>
            </div>
            <Link className={`mt-8 inline-flex items-center gap-2 ${TEXT_LINK}`} href="/resources/security">
              {t("control.security")}<ArrowUpRightIcon />
            </Link>
          </div>
        </section>

        <section id="open-source" aria-labelledby="open-source-title" className="scroll-mt-24">
          <div className={`${CONTAINER} py-16 sm:py-20 lg:py-28`}>
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-20">
              <div className="max-w-xl">
                <p className="text-sm text-muted">AGPL-3.0 · {t("openSource.eyebrow")}</p>
                <h2 id="open-source-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("openSource.title")}</h2>
                <p className="mt-5 text-base leading-7 text-muted sm:text-lg">{t("openSource.body")}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <ResourceCard href={REPO} title={t("openSource.source")} hint={t("openSource.sourceHint")} />
                <ResourceCard href="/resources/contributing" title={t("openSource.contribute")} hint={t("openSource.contributeHint")} />
                <ResourceCard href="/resources/roadmap" title={t("openSource.roadmap")} hint={t("openSource.roadmapHint")} />
              </div>
            </div>
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-24 border-y border-border bg-surface">
          <div className={`${CONTAINER} grid gap-10 py-16 sm:py-20 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20 lg:py-28`}>
            <div>
              <p className="text-sm text-muted">{t("faq.eyebrow")}</p>
              <h2 id="faq-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("faq.title")}</h2>
              <p className="mt-5 max-w-md text-base leading-7 text-muted sm:text-lg">{t("faq.intro")}</p>
            </div>

            <div className="divide-y divide-border border-y border-border">
              <FaqItem question={t("faq.items.account.question")}><p>{t("faq.items.account.answer")}</p></FaqItem>
              <FaqItem question={t("faq.items.ai.question")}><p>{t("faq.items.ai.answer")}</p></FaqItem>
              <FaqItem question={t("faq.items.recording.question")}><p>{t("faq.items.recording.answer")}</p></FaqItem>
              <FaqItem question={t("faq.items.contribute.question")}><p>{t("faq.items.contribute.answer")}</p></FaqItem>
              <FaqItem question={t("faq.items.hosting.question")}><p>{t("faq.items.hosting.answer")}</p></FaqItem>
            </div>
          </div>
        </section>

        <section aria-labelledby="final-title" className={`${CONTAINER} py-16 sm:py-20 lg:py-28`}>
          <div className="grid gap-8 rounded-[var(--radius-lg)] border border-border bg-foreground px-6 py-10 text-on-foreground sm:px-10 sm:py-14 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12 lg:px-14">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3"><LorMark /><p className="text-sm opacity-65">{t("final.eyebrow")}</p></div>
              <h2 id="final-title" className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{t("final.title")}</h2>
              <p className="mt-4 text-base leading-7 opacity-75 sm:text-lg">{t("final.body")}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href={LIVE_APP} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-on-foreground px-6 text-base font-medium text-foreground transition-opacity duration-150 hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-foreground">{t("final.liveCta")}<ArrowUpRightIcon /></a>
              <Link href="/docs" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-on-foreground/40 px-6 text-base font-medium text-on-foreground transition-colors duration-150 hover:bg-on-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-foreground">{t("final.docsCta")}<BookIcon /></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className={`${CONTAINER} flex flex-col gap-7 py-9 text-sm text-muted sm:flex-row sm:items-start sm:justify-between`}>
          <div>
            <div className="flex items-center gap-3"><LorWordmark className="h-7 w-auto" /><span className="text-muted">{t("footer.descriptor")}</span></div>
            <p className="mt-3 max-w-sm leading-6">{t("footer.tagline")}</p>
          </div>
          <nav aria-label={t("footer.label")} className="grid grid-cols-2 gap-x-8 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-6">
            <Link className={TEXT_LINK} href="/docs">{t("footer.docs")}</Link>
            <Link className={TEXT_LINK} href="/">{t("footer.product")}</Link>
            <Link className={TEXT_LINK} href="/resources/security">{t("footer.security")}</Link>
            <a className={TEXT_LINK} href={REPO}>{t("footer.source")}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function StoryStep({ number, icon, title, children }: { number: string; icon: ReactNode; title: string; children: ReactNode }) {
  return <li className="border-t border-border pt-5"><div className="flex items-center justify-between gap-4"><span dir="ltr" className="font-mono text-xs tabular-nums text-muted">{number}</span><span className="text-muted" aria-hidden="true">{icon}</span></div><h3 className="mt-8 text-xl font-medium tracking-tight">{title}</h3><p className="mt-3 text-base leading-7 text-muted">{children}</p></li>;
}

function FeatureCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <article className="bg-background p-6 sm:p-7"><span className="text-muted" aria-hidden="true">{icon}</span><h3 className="mt-6 text-lg font-medium tracking-tight">{title}</h3><p className="mt-3 text-base leading-7 text-muted">{children}</p></article>;
}

function GuardrailCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <article className="bg-background p-6 sm:p-7"><span className="text-muted" aria-hidden="true">{icon}</span><h3 className="mt-6 text-lg font-medium tracking-tight">{title}</h3><p className="mt-3 text-base leading-7 text-muted">{children}</p></article>;
}

function ResourceCard({ href, title, hint }: { href: string; title: string; hint: string }) {
  const className = "group flex min-h-16 items-center justify-between gap-4 rounded-[var(--radius-md)] border border-border bg-surface px-5 py-3 transition-colors duration-150 hover:bg-surface-strong";
  const content = <><span className="min-w-0"><span className="block font-medium">{title}</span><span className="mt-1 block text-sm leading-5 text-muted">{hint}</span></span><ArrowUpRightIcon className="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" /></>;
  return href.startsWith("/") ? <Link href={href} className={className}>{content}</Link> : <a href={href} className={className}>{content}</a>;
}

function ComparisonRow({ label, baseline, lor }: { label: string; baseline: string; lor: string }) {
  return <tr><th scope="row" className="px-5 py-5 text-start font-medium">{label}</th><td className="px-5 py-5 text-muted">{baseline}</td><td className="px-5 py-5"><span className="inline-flex items-start gap-2 font-medium"><CheckIcon /><span>{lor}</span></span></td></tr>;
}

function FaqItem({ question, children }: { question: string; children: ReactNode }) {
  return <details className="group"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-5 text-start font-medium [&::-webkit-details-marker]:hidden"><span>{question}</span><ChevronDownIcon className="shrink-0 text-muted transition-transform duration-150 group-open:rotate-180" /></summary><div className="max-w-2xl pb-6 pe-8 text-base leading-7 text-muted">{children}</div></details>;
}

function LorWordmark({ className = "" }: { className?: string }) {
  return <svg role="img" aria-label="LOR." viewBox="0 0 360 140" fill="none" className={className}><title>LOR.</title><g stroke="currentColor" strokeWidth="20" strokeLinecap="butt" strokeLinejoin="round"><path d="M10 20V110H60" /><circle cx="136" cy="70" r="40" /><path d="M222 20V120M222 30H256A25 25 0 0 1 256 80H222M222 80L301 110" /></g><circle cx="332" cy="105" r="15" fill="var(--live)" /></svg>;
}

function LorMark() {
  return <svg aria-hidden="true" viewBox="0 0 64 64" className="h-7 w-7"><circle cx="27" cy="30" r="13" fill="none" stroke="currentColor" strokeWidth="8" /><circle cx="50" cy="45" r="6" fill="var(--live)" /></svg>;
}

function ArrowUpRightIcon({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={`h-4 w-4 ${className}`}><path d="M5.5 14.5 14.5 5.5M7 5.5h7.5V13" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function BookIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H16v14H6.5A2.5 2.5 0 0 0 4 18V4.5ZM4 4.5V18M7 6h6M7 9h6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CodeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6"><path d="m7.25 6-4 4 4 4M12.75 6l4 4-4 4M11.5 4.5l-3 11" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function LinkIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6"><path d="m9.5 14.5 5-5M7.25 17.75l-1.5 1.5a3.18 3.18 0 0 1-4.5-4.5l3.5-3.5a3.18 3.18 0 0 1 4.5 0M16.75 6.25l1.5-1.5a3.18 3.18 0 1 1 4.5 4.5l-3.5 3.5a3.18 3.18 0 0 1-4.5 0" strokeLinecap="round" /></svg>;
}

function TogetherIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6"><circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" /><path d="M2.5 19c.6-3 2.4-4.5 5.5-4.5S12.9 16 13.5 19M10.5 19c.6-3 2.4-4.5 5.5-4.5s4.9 1.5 5.5 4.5" strokeLinecap="round" /></svg>;
}

function EvidenceIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6"><path d="M5 4.5h14v15H5z" strokeLinejoin="round" /><path d="M8 9h8M8 12.5h6M8 16h4" strokeLinecap="round" /><path d="M8 4.5V3h8v1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CaptionIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6"><path d="M4 6.5h16v11H4z" strokeLinejoin="round" /><path d="M7 10h3M14 10h3M7 14h6" strokeLinecap="round" /></svg>;
}

function TimelineIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6"><path d="M5 5v14M5 7h14M5 12h10M5 17h7" strokeLinecap="round" /><circle cx="19" cy="7" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="12" cy="17" r="1.5" /></svg>;
}

function ChevronDownIcon({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={`h-4 w-4 ${className}`}><path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
