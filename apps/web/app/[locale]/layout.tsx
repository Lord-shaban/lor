import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Geist, Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
import { ThemeScript } from "@/components/theme-script";
import { direction, routing, type Locale } from "@/i18n/routing";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-latin",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono-latin",
  subsets: ["latin"],
});

// Geist has no Arabic coverage at all. IBM Plex Sans Arabic is the counterpart:
// geometric, unadorned, and drawn to sit beside a Latin grotesque rather than
// after one.
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    ),
    title: t("title"),
    description: t("description"),
    // "/" negotiates the locale from the cookie or Accept-Language and rewrites
    // internally, so the same content is reachable at "/" and at "/ar". These
    // tell a crawler which URL belongs to which language and which is default,
    // rather than leaving it to guess at duplicate pages.
    alternates: {
      languages: {
        ar: "/ar",
        en: "/en",
        "x-default": "/",
      },
    },

    // iOS ignores the web app manifest for most of this and reads its own
    // meta tags instead, so an installable app on an iPhone needs both.
    appleWebApp: {
      capable: true,
      title: "LOR.",
      // Matches the call, which is the screen an installed app spends its life
      // on. A light status bar over a dark call reads as a rendering bug.
      statusBarStyle: "black-translucent",
    },

    other: {
      // Next emits only the unprefixed `mobile-web-app-capable` for
      // `appleWebApp.capable`, which is the modern name — and the one Safari
      // did not read for most of its life. Emitting both costs a line and is
      // the difference between installable on an iPhone and not. Checked by
      // reading the rendered head, not by trusting the option name.
      "apple-mobile-web-app-capable": "yes",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Required for the static rendering of every page nested under this layout.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={direction[locale as Locale]}
      className={`${geistSans.variable} ${geistMono.variable} ${plexArabic.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
