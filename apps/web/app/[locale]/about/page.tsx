import type { Metadata } from "next";
import { use } from "react";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { ProductScreenshot } from "@/components/product-screenshot";
import { LandingMeetingShowcase } from "@/components/landing-meeting-showcase";
import {
  BoardIcon,
  RecordIcon,
  SearchIcon,
  ShieldIcon,
} from "@/components/landing-icons";

const CONTAINER = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12";
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
      <a
        href="#main-content"
        className="sr-only absolute start-4 top-4 z-50 rounded-sm bg-foreground px-4 py-3 text-on-foreground focus:not-sr-only"
      >
        {t("skip")}
      </a>

      <header className="z-30 border-b border-border bg-background/95 lg:sticky lg:top-0 lg:backdrop-blur-sm">
        <div className={`${CONTAINER} py-4`}>
          <div className="grid grid-cols-[auto_1fr] items-center gap-3 sm:grid-cols-[auto_1fr_auto]">
            <Link href="/" aria-label="LOR." className="inline-flex min-h-11 items-center justify-self-start">
              <Brand size="md" />
            </Link>

            <nav
              aria-label={t("nav.label")}
              className="order-3 col-span-2 flex flex-wrap items-center gap-x-5 text-sm text-muted sm:order-none sm:col-span-1 sm:justify-center"
            >
              <a className={`inline-flex min-h-11 items-center ${TEXT_LINK}`} href="#story">
                {t("nav.product")}
              </a>
              <a className={`inline-flex min-h-11 items-center ${TEXT_LINK}`} href="#features">
                {t("nav.features")}
              </a>
              <Link className={`inline-flex min-h-11 items-center ${TEXT_LINK}`} href="/docs">
                {t("nav.docs")}
              </Link>
              <a className={`inline-flex min-h-11 items-center ${TEXT_LINK}`} href="#compare">
                {t("nav.compare")}
              </a>
            </nav>

            <div className="flex items-center justify-self-end gap-2 sm:gap-3 [&_nav_a]:inline-flex [&_nav_a]:min-h-11 [&_nav_a]:items-center [&_button]:min-h-11">
              <Button asChild size="md" className="hidden sm:inline-flex">
                <Link href="/">{t("nav.try")}</Link>
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
            className={`${CONTAINER} grid gap-10 py-12 sm:py-16 lg:gap-14 lg:py-20`}
          >
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-16">
              <div>
                <div className="mb-6 flex flex-wrap items-center gap-4"><Brand size="lg" /><span className="border-s border-border ps-4 text-sm text-muted">{t("hero.kicker")}</span></div>
                <h1 id="landing-title" className="max-w-[20ch] text-4xl font-semibold leading-[1.2] tracking-tight text-balance sm:text-5xl lg:text-6xl">{t("hero.title")}</h1>
              </div>
              <div className="max-w-xl">
                <p className="text-lg leading-8 text-muted">{t.rich("hero.description", { brand: chunks => <bdi className="font-medium text-foreground">{chunks}</bdi> })}</p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button asChild size="lg"><Link href="/">{t("hero.liveCta")}<ArrowUpRightIcon /></Link></Button>
                  <Button asChild size="lg" variant="outline"><Link href="/docs">{t("hero.docsCta")}<BookIcon /></Link></Button>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted">{t("hero.sourceLead")} <Link className={TEXT_LINK} href="/resources/source">{t("hero.sourceCta")}</Link></p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-7 gap-y-3 border-t border-border pt-5 text-sm text-muted">
              <span className="inline-flex items-center gap-2"><CodeIcon />{t("hero.proofLicense")}</span>
              <span>{t("hero.proofLocale")}</span>
              <Link href="/resources/roadmap" className={TEXT_LINK}>{t("hero.proofStatus")}</Link>
            </div>
            <LandingMeetingShowcase />
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

            <div className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-14">
              <ProductScreenshot src={`/landing/product-home-${locale}.webp`} alt={t("screenshot.homeAlt")} label={t("screenshot.homeLabel")} caption={t("screenshot.homeCaption")} inspect={t("screenshot.inspect")} sizes="(max-width: 1024px) 100vw, 640px" />
              <ol className="grid gap-7">
                <StoryStep number="01" icon={<LinkIcon />} title={t("story.steps.join.title")}>{t.rich("story.steps.join.body", { term: chunks => <bdi>{chunks}</bdi> })}</StoryStep>
                <StoryStep number="02" icon={<TogetherIcon />} title={t("story.steps.together.title")}>{t.rich("story.steps.together.body", { term: chunks => <bdi>{chunks}</bdi> })}</StoryStep>
                <StoryStep number="03" icon={<EvidenceIcon />} title={t("story.steps.evidence.title")}>{t.rich("story.steps.evidence.body", { term: chunks => <bdi>{chunks}</bdi> })}</StoryStep>
              </ol>
            </div>
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

            <div className="mt-12 hidden overflow-hidden rounded-[var(--radius-lg)] border border-border bg-background lg:block">
              <table className="w-full table-fixed border-collapse text-start text-sm leading-6">
                <caption className="sr-only">{t("compare.caption")}</caption>
                <thead className="bg-surface">
                  <tr className="border-b border-border">
                    <th scope="col" className="text-start w-[22%] px-5 py-4 font-medium">{t("compare.capability")}</th>
                    <th scope="col" className="text-start w-[26%] bg-foreground px-5 py-5 font-semibold text-on-foreground"><Brand size="md" /> <span className="mt-2 block text-xs font-normal">{t("compare.lorHint")}</span></th>
                    <th scope="col" className="text-start w-[26%] px-5 py-4 font-medium">Zoom</th>
                    <th scope="col" className="text-start w-[26%] px-5 py-4 font-medium">Google Meet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(["openSource", "join", "collaboration", "captions", "record", "evidence", "keys", "search"] as const).map((row) => (
                    <ComparisonRow key={row} label={t(`compare.rows.${row}.label`)} lor={t(`compare.rows.${row}.lor`)} zoom={t(`compare.rows.${row}.zoom`)} meet={t(`compare.rows.${row}.meet`)} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-10 grid gap-4 lg:hidden">
              {(["openSource", "join", "collaboration", "captions", "record", "evidence", "keys", "search"] as const).map((row) => (
                <article key={row} className="rounded-[var(--radius-lg)] border border-border bg-background p-5">
                  <h3 className="font-semibold">{t(`compare.rows.${row}.label`)}</h3>
                  <dl className="mt-4 grid gap-3 text-sm leading-6 sm:grid-cols-3">
                    <div className="rounded-[var(--radius-md)] bg-foreground p-4 text-on-foreground"><dt className="font-semibold">{t("compare.lor")}</dt><dd className="mt-1">{t(`compare.rows.${row}.lor`)}</dd></div>
                    <div className="px-1 py-2"><dt className="font-medium">Zoom</dt><dd className="mt-1 text-muted">{t(`compare.rows.${row}.zoom`)}</dd></div>
                    <div className="px-1 py-2"><dt className="font-medium">Google Meet</dt><dd className="mt-1 text-muted">{t(`compare.rows.${row}.meet`)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
            <p className="mt-5 max-w-4xl text-sm leading-6 text-muted">{t("compare.note")}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <a className={TEXT_LINK} href="https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0059553">{t("compare.sources.zoomJoin")}</a>
              <a className={TEXT_LINK} href="https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0058013">{t("compare.sources.zoomSummary")}</a>
              <a className={TEXT_LINK} href="https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0059856">{t("compare.sources.zoomRecord")}</a>
              <a className={TEXT_LINK} href="https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0058810">{t("compare.sources.zoomCaptions")}</a>
              <a className={TEXT_LINK} href="https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0078289">{t("compare.sources.zoomTasks")}</a>
              <a className={TEXT_LINK} href="https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0057861">{t("compare.sources.zoomData")}</a>
              <a className={TEXT_LINK} href="https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0076631">{t("compare.sources.zoomQuestions")}</a>
              <a className={TEXT_LINK} href="https://support.google.com/meet/answer/9303069?hl=en">{t("compare.sources.meetJoin")}</a>
              <a className={TEXT_LINK} href="https://support.google.com/meet/answer/14754931?hl=en">{t("compare.sources.meetNotes")}</a>
              <a className={TEXT_LINK} href="https://support.google.com/meet/answer/9308681?hl=en">{t("compare.sources.meetRecord")}</a>
              <a className={TEXT_LINK} href="https://support.google.com/meet/answer/15077804?hl=en">{t("compare.sources.meetCaptions")}</a>
              <a className={TEXT_LINK} href="https://support.google.com/meet/answer/16024610?hl=en">{t("compare.sources.meetQuestions")}</a>
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

              <div className="grid gap-3">
                <ResourceCard href="/resources/source" title={t("openSource.source")} hint={t("openSource.sourceHint")} />
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
              <div className="flex items-center gap-3"><Brand size="md" /><p className="text-sm opacity-65">{t("final.eyebrow")}</p></div>
              <h2 id="final-title" className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{t("final.title")}</h2>
              <p className="mt-4 text-base leading-7 opacity-75 sm:text-lg">{t("final.body")}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-on-foreground px-6 text-base font-medium text-foreground transition-opacity duration-150 hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-foreground">{t("final.liveCta")}<ArrowUpRightIcon /></Link>
              <Link href="/docs" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-on-foreground/40 px-6 text-base font-medium text-on-foreground transition-colors duration-150 hover:bg-on-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-foreground">{t("final.docsCta")}<BookIcon /></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className={`${CONTAINER} flex flex-col gap-7 py-9 text-sm text-muted sm:flex-row sm:items-start sm:justify-between`}>
          <div>
            <div className="flex items-center gap-3"><Brand size="md" /><span className="text-muted">{t("footer.descriptor")}</span></div>
            <p className="mt-3 max-w-sm leading-6">{t("footer.tagline")}</p>
          </div>
          <nav aria-label={t("footer.label")} className="grid grid-cols-2 gap-x-8 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-6">
            <Link className={TEXT_LINK} href="/docs">{t("footer.docs")}</Link>
            <Link className={TEXT_LINK} href="/">{t("footer.product")}</Link>
            <Link className={TEXT_LINK} href="/resources/security">{t("footer.security")}</Link>
            <Link className={TEXT_LINK} href="/resources/source">{t("footer.source")}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function StoryStep({ number, icon, title, children }: { number: string; icon: ReactNode; title: string; children: ReactNode }) {
  return <li className="border-t border-border pt-5"><div className="flex items-center justify-between gap-4"><span dir="ltr" className="font-mono text-xs tabular-nums text-muted">{number}</span><span className="text-muted" aria-hidden="true">{icon}</span></div><h3 className="mt-3 text-xl font-medium tracking-tight">{title}</h3><p className="mt-3 text-base leading-7 text-muted">{children}</p></li>;
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
  return <Link href={href} className={className}>{content}</Link>;
}

function ComparisonRow({ label, lor, zoom, meet }: { label: string; lor: string; zoom: string; meet: string }) {
  return <tr><th scope="row" className="px-5 py-5 text-start font-medium">{label}</th><td className="border-x border-border bg-surface-strong px-5 py-5 font-medium">{lor}</td><td className="px-5 py-5 text-muted">{zoom}</td><td className="px-5 py-5 text-muted">{meet}</td></tr>;
}

function FaqItem({ question, children }: { question: string; children: ReactNode }) {
  return <details className="group"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-5 text-start font-medium [&::-webkit-details-marker]:hidden"><span>{question}</span><ChevronDownIcon className="shrink-0 text-muted transition-transform duration-150 group-open:rotate-180" /></summary><div className="max-w-2xl pb-6 pe-8 text-base leading-7 text-muted">{children}</div></details>;
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
