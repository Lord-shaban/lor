"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { localeLabel, routing, type Locale } from "@/i18n/routing";

/**
 * Keeps you on the same page when you switch. `usePathname` from
 * `@/i18n/navigation` returns the path without the locale prefix, and `Link`
 * re-adds the one you picked.
 */
export function LocaleSwitcher() {
  const t = useTranslations("localeSwitcher");
  const active = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="flex items-center gap-3 text-sm">
      {routing.locales.map((locale) => {
        const isActive = locale === active;
        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            hrefLang={locale}
            aria-current={isActive ? "true" : undefined}
            aria-label={isActive ? undefined : t("switchTo", { locale: localeLabel[locale] })}
            className={
              isActive
                ? "underline underline-offset-4"
                : "opacity-55 underline underline-offset-4 hover:opacity-100"
            }
          >
            {/* Each locale names itself, so the label is always in its own
                script and needs isolating from the surrounding direction. */}
            <bdi>{localeLabel[locale as Locale]}</bdi>
          </Link>
        );
      })}
    </nav>
  );
}
