import type { Metadata } from "next";
import Image from "next/image";
import { use } from "react";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LandingCopyCommand } from "@/components/landing-copy-command";
import {
  BoardIcon,
  CheckIcon,
  RecordIcon,
  SearchIcon,
  ShieldIcon,
  SparkIcon,
  QuestionIcon,
} from "@/components/landing-icons";

const REPO = "https://github.com/Lord-shaban/lor";
const LIVE_APP = "https://lor-bay.vercel.app";
const SETUP = `${REPO}#quick-start`;
const CONTAINER = "mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-10";
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
              className="order-3 flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted sm:order-none sm:w-auto sm:justify-start sm:gap-x-5"
            >
              <a className={TEXT_LINK} href="#overview">
                {t("nav.overview")}
              </a>
              <a className={TEXT_LINK} href="#features">
                {t("nav.features")}
              </a>
              <a className={TEXT_LINK} href="#compare">
                {t("nav.compare")}
              </a>
              <a className={TEXT_LINK} href="#open-source">
                {t("nav.openSource")}
              </a>
              <a className={TEXT_LINK} href="#faq">
                {t("nav.faq")}
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

      <div className="border-b border-border bg-surface">
        <div className={`${CONTAINER} flex flex-wrap items-center justify-between gap-3 py-3 text-sm`}>
          <p className="flex items-center gap-2 text-muted">
            <span className="h-2 w-2 rounded-full bg-live" aria-hidden="true" />
            <span>{t("banner.label")}</span>
          </p>
          <a className={`inline-flex items-center gap-2 ${TEXT_LINK}`} href="#compare">
            {t("banner.link")}
            <ArrowUpRightIcon />
          </a>
        </div>
      </div>

      <main id="main-content" tabIndex={-1}>
        <section
          aria-labelledby="landing-title"
          className={`${CONTAINER} grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:py-24`}
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

            <p className="mt-4 max-w-lg text-base leading-7 text-muted">
              {t("hero.supporting")}
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
              className="mt-8 grid gap-3 border-y border-border py-4 text-sm text-muted sm:grid-cols-3 sm:gap-4"
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

        <section id="overview" aria-labelledby="overview-title" className="scroll-mt-8 border-y border-border bg-surface">
          <div className={`${CONTAINER} py-16 sm:py-20 lg:py-24`}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
              <div className="max-w-2xl">
                <p className="text-sm text-muted">{t("overview.eyebrow")}</p>
                <h2 id="overview-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {t("overview.title")}
                </h2>
              </div>
              <p className="max-w-md text-base leading-7 text-muted sm:text-lg">{t("overview.intro")}</p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              <OverviewCard icon={<SparkIcon />} title={t("overview.cards.conversation.title")}>
                {t("overview.cards.conversation.body")}
              </OverviewCard>
              <OverviewCard icon={<BoardIcon />} title={t("overview.cards.work.title")}>
                {t("overview.cards.work.body")}
              </OverviewCard>
              <OverviewCard icon={<RecordIcon />} title={t("overview.cards.record.title")}>
                {t("overview.cards.record.body")}
              </OverviewCard>
            </div>
          </div>
        </section>

        <section id="story" aria-labelledby="story-title" className="scroll-mt-8">
          <div className={`${CONTAINER} py-16 sm:py-20 lg:py-24`}>
            <div className="max-w-2xl">
              <p className="text-sm text-muted">{t("story.eyebrow")}</p>
              <h2 id="story-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("story.title")}
              </h2>
              <p className="mt-5 text-base leading-7 text-muted sm:text-lg">{t("story.intro")}</p>
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

        <section id="features" aria-labelledby="features-title" className="scroll-mt-8 border-y border-border bg-surface">
          <div className={`${CONTAINER} py-16 sm:py-20 lg:py-24`}>
            <div className="max-w-2xl">
              <p className="text-sm text-muted">{t("features.eyebrow")}</p>
              <h2 id="features-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("features.title")}
              </h2>
              <p className="mt-5 text-base leading-7 text-muted sm:text-lg">{t("features.intro")}</p>
            </div>

            <div className="mt-12 grid gap-px overflow-hidden border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard icon={<CaptionIcon />} title={t("features.cards.captions.title")}>
                {t("features.cards.captions.body")}
              </FeatureCard>
              <FeatureCard icon={<BoardIcon />} title={t("features.cards.collaboration.title")}>
                {t("features.cards.collaboration.body")}
              </FeatureCard>
              <FeatureCard icon={<RecordIcon />} title={t("features.cards.recording.title")}>
                {t("features.cards.recording.body")}
              </FeatureCard>
              <FeatureCard icon={<EvidenceIcon />} title={t("features.cards.decisions.title")}>
                {t("features.cards.decisions.body")}
              </FeatureCard>
              <FeatureCard icon={<TimelineIcon />} title={t("features.cards.timeline.title")}>
                {t("features.cards.timeline.body")}
              </FeatureCard>
              <FeatureCard icon={<SearchIcon />} title={t("features.cards.search.title")}>
                {t("features.cards.search.body")}
              </FeatureCard>
            </div>
          </div>
        </section>

        <section id="compare" aria-labelledby="compare-title" className="scroll-mt-8">
          <div className={`${CONTAINER} py-16 sm:py-20 lg:py-24`}>
            <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-end lg:gap-20">
              <div>
                <p className="text-sm text-muted">{t("compare.eyebrow")}</p>
                <h2 id="compare-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {t("compare.title")}
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-7 text-muted sm:text-lg">{t("compare.intro")}</p>
            </div>

            <div className="mt-12 overflow-x-auto rounded-[var(--radius-lg)] border border-border">
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
            <p className="mt-4 text-sm text-muted">{t("compare.note")}</p>
          </div>
        </section>

        <section aria-labelledby="control-title" className="border-y border-border bg-surface">
          <div className={`${CONTAINER} py-16 sm:py-20 lg:py-24`}>
            <div className="max-w-2xl">
              <p className="text-sm text-muted">{t("control.eyebrow")}</p>
              <h2 id="control-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("control.title")}
              </h2>
              <p className="mt-5 text-base leading-7 text-muted sm:text-lg">{t("control.intro")}</p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              <GuardrailCard icon={<ShieldIcon />} title={t("control.cards.scope.title")}>
                {t("control.cards.scope.body")}
              </GuardrailCard>
              <GuardrailCard icon={<RecordIcon />} title={t("control.cards.local.title")}>
                {t("control.cards.local.body")}
              </GuardrailCard>
              <GuardrailCard icon={<CodeIcon />} title={t("control.cards.keys.title")}>
                {t("control.cards.keys.body")}
              </GuardrailCard>
            </div>
            <a className={`mt-8 inline-flex items-center gap-2 ${TEXT_LINK}`} href={`${REPO}/blob/main/SECURITY.md`}>
              {t("control.security")}
              <ArrowUpRightIcon />
            </a>
          </div>
        </section>

        <section id="open-source" aria-labelledby="open-source-title" className="scroll-mt-8">
          <div className={`${CONTAINER} py-16 sm:py-20 lg:py-24`}>
            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-20">
              <div>
                <p className="text-sm text-muted">AGPL-3.0 · {t("openSource.eyebrow")}</p>
                <h2 id="open-source-title" className="mt-4 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                  {t("openSource.title")}
                </h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">{t("openSource.body")}</p>

                <div className="mt-8 grid gap-3">
                  <ResourceCard href={REPO} title={t("openSource.source")} hint={t("openSource.sourceHint")} />
                  <ResourceCard href={`${REPO}/blob/main/CONTRIBUTING.md`} title={t("openSource.contribute")} hint={t("openSource.contributeHint")} />
                  <ResourceCard href={`${REPO}/milestones`} title={t("openSource.roadmap")} hint={t("openSource.roadmapHint")} />
                </div>
              </div>

              <div className="overflow-hidden rounded-[var(--radius-lg)] bg-foreground text-on-foreground">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-on-foreground/20 px-5 py-4 sm:px-6">
                  <div>
                    <p className="text-sm font-medium">{t("quickStart.label")}</p>
                    <p className="mt-1 text-sm opacity-65">{t("quickStart.hint")}</p>
                  </div>
                  <LandingCopyCommand value={QUICK_START} copyLabel={t("quickStart.copy")} copiedLabel={t("quickStart.copied")} />
                </div>
                <pre className="overflow-x-auto p-5 text-sm leading-7 sm:p-6"><code>{QUICK_START}</code></pre>
                <div className="border-t border-on-foreground/20 px-5 py-4 text-sm opacity-75 sm:px-6">{t("quickStart.note")}</div>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-title" className="border-y border-border bg-surface scroll-mt-8">
          <div className={`${CONTAINER} grid gap-10 py-16 sm:py-20 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20 lg:py-24`}>
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

        <section aria-labelledby="final-title" className={`${CONTAINER} py-16 sm:py-20 lg:py-24`}>
          <div className="rounded-[var(--radius-lg)] bg-foreground px-6 py-12 text-on-foreground sm:px-10 sm:py-16 lg:flex lg:items-end lg:justify-between lg:gap-12 lg:px-14">
            <div className="max-w-xl">
              <p className="text-sm opacity-65">{t("final.eyebrow")}</p>
              <h2 id="final-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("final.title")}</h2>
              <p className="mt-4 text-base leading-7 opacity-75 sm:text-lg">{t("final.body")}</p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:shrink-0">
              <a href={LIVE_APP} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-on-foreground px-6 text-base font-medium text-foreground transition-opacity duration-150 hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-foreground">
                {t("final.liveCta")}
                <ArrowUpRightIcon />
              </a>
              <a href={REPO} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-on-foreground/40 px-6 text-base font-medium text-on-foreground transition-colors duration-150 hover:bg-on-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-foreground">
                {t("final.sourceCta")}
                <CodeIcon />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className={`${CONTAINER} flex flex-col gap-6 py-8 text-sm text-muted sm:flex-row sm:items-start sm:justify-between`}>
          <div>
            <p>{t.rich("footer.name", { brand: (chunks) => <bdi className="text-foreground">{chunks}</bdi> })}</p>
            <p className="mt-2 max-w-sm leading-6">{t("footer.tagline")}</p>
          </div>
          <nav aria-label={t("footer.label")} className="grid grid-cols-2 gap-x-8 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-5">
            <a className={TEXT_LINK} href={SETUP}>{t("footer.setup")}</a>
            <a className={TEXT_LINK} href={`${REPO}/blob/main/SECURITY.md`}>{t("footer.security")}</a>
            <a className={TEXT_LINK} href={`${REPO}/releases`}>{t("footer.releases")}</a>
            <a className={TEXT_LINK} href={`${REPO}/discussions`}>{t("footer.community")}</a>
            <Link className={TEXT_LINK} href="/">{t("footer.product")}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function OverviewCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <article className="border border-border bg-background p-6 sm:p-7">
      <span className="text-muted" aria-hidden="true">{icon}</span>
      <h3 className="mt-8 text-xl font-medium tracking-tight">{title}</h3>
      <p className="mt-3 text-base leading-7 text-muted">{children}</p>
    </article>
  );
}

function StoryStep({ number, icon, title, children }: { number: string; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="border-t border-border pt-5">
      <div className="flex items-center justify-between gap-4">
        <span dir="ltr" className="font-mono text-xs tabular-nums text-muted">{number}</span>
        <span className="text-muted" aria-hidden="true">{icon}</span>
      </div>
      <h3 className="mt-8 text-xl font-medium tracking-tight">{title}</h3>
      <p className="mt-3 text-base leading-7 text-muted">{children}</p>
    </li>
  );
}

function FeatureCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <article className="bg-background p-6 sm:p-7">
      <span className="text-muted" aria-hidden="true">{icon}</span>
      <h3 className="mt-6 text-lg font-medium tracking-tight">{title}</h3>
      <p className="mt-3 text-base leading-7 text-muted">{children}</p>
    </article>
  );
}

function GuardrailCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <article className="border border-border bg-background p-6 sm:p-7">
      <span className="text-muted" aria-hidden="true">{icon}</span>
      <h3 className="mt-6 text-lg font-medium tracking-tight">{title}</h3>
      <p className="mt-3 text-base leading-7 text-muted">{children}</p>
    </article>
  );
}

function ResourceCard({ href, title, hint }: { href: string; title: string; hint: string }) {
  return (
    <a href={href} className="group flex min-h-16 items-center justify-between gap-4 rounded-[var(--radius-md)] border border-border bg-surface px-5 transition-colors duration-150 hover:bg-surface-strong">
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="mt-1 block text-sm text-muted">{hint}</span>
      </span>
      <ArrowUpRightIcon className="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
    </a>
  );
}

function ComparisonRow({ label, baseline, lor }: { label: string; baseline: string; lor: string }) {
  return (
    <tr>
      <th scope="row" className="px-5 py-5 text-start font-medium">{label}</th>
      <td className="px-5 py-5 text-muted">{baseline}</td>
      <td className="px-5 py-5">
        <span className="inline-flex items-start gap-2 font-medium">
          <CheckIcon />
          <span>{lor}</span>
        </span>
      </td>
    </tr>
  );
}

function FaqItem({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-5 text-start font-medium [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <span className="flex shrink-0 items-center gap-2 text-muted" aria-hidden="true">
          <QuestionIcon />
          <ChevronDownIcon className="transition-transform duration-150 group-open:rotate-180" />
        </span>
      </summary>
      <div className="max-w-2xl pb-6 pe-8 text-base leading-7 text-muted">{children}</div>
    </details>
  );
}

function ArrowUpRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={`h-4 w-4 ${className}`}>
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
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
      <path d="m9.5 14.5 5-5M7.25 17.75l-1.5 1.5a3.18 3.18 0 0 1-4.5-4.5l3.5-3.5a3.18 3.18 0 0 1 4.5 0M16.75 6.25l1.5-1.5a3.18 3.18 0 1 1 4.5 4.5l-3.5 3.5a3.18 3.18 0 0 1-4.5 0" strokeLinecap="round" />
    </svg>
  );
}

function TogetherIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <path d="M2.5 19c.6-3 2.4-4.5 5.5-4.5S12.9 16 13.5 19M10.5 19c.6-3 2.4-4.5 5.5-4.5s4.9 1.5 5.5 4.5" strokeLinecap="round" />
    </svg>
  );
}

function EvidenceIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
      <path d="M5 4.5h14v15H5z" strokeLinejoin="round" />
      <path d="M8 9h8M8 12.5h6M8 16h4" strokeLinecap="round" />
      <path d="M8 4.5V3h8v1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CaptionIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
      <path d="M4 6.5h16v11H4z" strokeLinejoin="round" />
      <path d="M7 10h3M14 10h3M7 14h6" strokeLinecap="round" />
    </svg>
  );
}

function TimelineIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
      <path d="M5 5v14M5 7h14M5 12h10M5 17h7" strokeLinecap="round" />
      <circle cx="19" cy="7" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="12" cy="17" r="1.5" />
    </svg>
  );
}

function ChevronDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={`h-4 w-4 ${className}`}>
      <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
