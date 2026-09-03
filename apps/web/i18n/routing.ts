import { defineRouting } from "next-intl/routing";

/**
 * Arabic is the default, not a translation of an English original. A visitor with
 * no locale preference lands on Arabic, and RTL is the layout the interface is
 * designed against.
 */
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  // The default locale carries no prefix, so a room link stays as short as it
  // was designed to be: lor.dev/mza-krf-tqn, not lor.dev/ar/mza-krf-tqn.
  // English rooms live at lor.dev/en/mza-krf-tqn.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

/** Text direction for a locale. Used on <html dir> and by layout logic. */
export const direction: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

/** How each locale names itself, for the switcher. */
export const localeLabel: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};
