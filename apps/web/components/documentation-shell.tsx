import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Brand } from "@/components/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

type TocItem = { id: string; label: string };

const copy = {
  ar: {
    docs: "التوثيق", product: "عن المنتج", start: "ابدأ اجتماعاً", skip: "انتقل إلى المحتوى",
    browse: "تصفح التوثيق", guide: "دليل المنتج", overview: "نظرة عامة", meeting: "استخدام الاجتماع",
    local: "التشغيل المحلي", project: "المشروع", security: "الأمان والخصوصية", contributing: "المساهمة",
    roadmap: "خريطة الطريق", source: "الشيفرة المصدرية", license: "الترخيص", help: "المساعدة",
    onPage: "في هذه الصفحة", release: "الإصدار المتاح", note: "اجتماعات مفتوحة المصدر تحتفظ بنتائجها.",
  },
  en: {
    docs: "Documentation", product: "About", start: "Start a meeting", skip: "Skip to content",
    browse: "Browse documentation", guide: "Product guide", overview: "Overview", meeting: "Using a meeting",
    local: "Local development", project: "The project", security: "Security and privacy", contributing: "Contributing",
    roadmap: "Roadmap", source: "Source code", license: "License", help: "Help and support",
    onPage: "On this page", release: "Current release", note: "Open-source meetings that keep their results.",
  },
};

export function DocumentationShell({ locale, current = "docs", toc, children }: {
  locale: string; current?: string; toc: TocItem[]; children: ReactNode;
}) {
  const t = copy[locale === "en" ? "en" : "ar"];
  const links = [
    { href: "/resources/security", key: "security", label: t.security },
    { href: "/resources/contributing", key: "contributing", label: t.contributing },
    { href: "/resources/roadmap", key: "roadmap", label: t.roadmap },
    { href: "/resources/source", key: "source", label: t.source },
    { href: "/resources/license", key: "license", label: t.license },
    { href: "/resources/help", key: "help", label: t.help },
  ];
  const navigation = (
    <nav aria-label={t.browse} className="space-y-7">
      <div>
        <p className="px-3 text-xs font-semibold text-muted">{t.guide}</p>
        <div className="mt-2 grid gap-1">
          <NavigationLink href="/docs" active={current === "docs"}>{t.overview}</NavigationLink>
          <NavigationLink href="/docs#workflow">{t.meeting}</NavigationLink>
          <NavigationLink href="/docs#quick-start">{t.local}</NavigationLink>
        </div>
      </div>
      <div>
        <p className="px-3 text-xs font-semibold text-muted">{t.project}</p>
        <div className="mt-2 grid gap-1">{links.map((link) => (
          <NavigationLink key={link.key} href={link.href} active={current === link.key}>{link.label}</NavigationLink>
        ))}</div>
      </div>
      <div className="mx-3 border-t border-border pt-5">
        <p className="text-xs text-muted">{t.release}</p>
        <p className="mt-2 font-mono text-sm" dir="ltr">v0.7.0 <span className="font-sans text-muted">/ AGPL-3.0</span></p>
      </div>
    </nav>
  );

  return (
    <div className="min-h-full bg-background text-foreground">
      <a href="#documentation-content" className="sr-only absolute start-4 top-4 z-50 rounded-md bg-foreground px-4 py-3 text-on-foreground focus:not-sr-only">{t.skip}</a>
      <header className="relative z-30 border-b border-border bg-background/95 lg:sticky lg:top-0 lg:backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/" aria-label="LOR." className="inline-flex min-h-11 items-center"><Brand size="sm" /></Link>
            <span aria-hidden="true" className="h-5 w-px bg-border" />
            <Link href="/docs" className="flex min-h-11 min-w-11 items-center text-sm font-semibold">
              <span className="sm:hidden">{locale === "en" ? "Docs" : t.docs}</span>
              <span className="hidden sm:inline">{t.docs}</span>
            </Link>
          </div>
          <div className="flex items-center gap-1 sm:gap-3 [&_nav_a]:inline-flex [&_nav_a]:min-h-11 [&_nav_a]:min-w-11 [&_nav_a]:items-center [&_nav_a]:justify-center [&_button]:min-h-11">
            <Link href="/about" className="hidden min-h-11 items-center px-2 text-sm text-muted hover:text-foreground sm:inline-flex">{t.product}</Link>
            <Link href="/" className="hidden min-h-11 items-center rounded-md bg-foreground px-4 text-sm font-medium text-on-foreground sm:inline-flex">{t.start}</Link>
            <ThemeToggle /><LocaleSwitcher />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-10">
        <div className="border-b border-border py-4 lg:hidden">
          <details className="group rounded-md border border-border bg-surface">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
              {t.browse}<Chevron />
            </summary>
            <div className="border-t border-border p-3">{navigation}</div>
          </details>
        </div>
        <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[13rem_minmax(0,1fr)_10rem] xl:gap-14">
          <aside className="hidden border-e border-border pe-6 lg:block">
            <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto py-8">{navigation}</div>
          </aside>
          <main id="documentation-content" tabIndex={-1} className="min-w-0 py-8 sm:py-12">{children}</main>
          <aside className="hidden xl:block">
            <nav aria-label={t.onPage} className="sticky top-28 py-2">
              <p className="text-xs font-semibold text-muted">{t.onPage}</p>
              <ul className="mt-4 space-y-1 border-s border-border">
                {toc.map((item) => <li key={item.id}><a href={`#${item.id}`} className="flex min-h-11 items-center ps-4 text-sm leading-5 text-muted hover:text-foreground">{item.label}</a></li>)}
              </ul>
            </nav>
          </aside>
        </div>
      </div>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div className="flex items-center gap-4"><Brand size="sm" /><p className="max-w-sm text-sm leading-6 text-muted">{t.note}</p></div>
          <nav aria-label={t.project} className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            <Link className="flex min-h-11 items-center hover:text-foreground" href="/resources/source">{t.source}</Link>
            <Link className="flex min-h-11 items-center hover:text-foreground" href="/resources/security">{t.security}</Link>
            <Link className="flex min-h-11 items-center hover:text-foreground" href="/resources/license">AGPL-3.0</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function NavigationLink({ href, active = false, children }: { href: string; active?: boolean; children: ReactNode }) {
  return <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center rounded-md px-3 text-sm transition-colors duration-150 ${active ? "bg-surface-strong font-semibold text-foreground" : "text-muted hover:bg-surface hover:text-foreground"}`}>{children}</Link>;
}

function Chevron() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"><path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
