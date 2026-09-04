import type { MetadataRoute } from "next";

/**
 * What a phone needs to install this.
 *
 * A manifest is single-locale — the browser fetches one document and shows it
 * to whoever is installing. Arabic is this project's fallback locale, so that
 * is what the description is in, and the name is the wordmark, which is the
 * same in both.
 *
 * Not exported per locale on purpose: a manifest is only read by the browser
 * when installing, and negotiating one would mean either a credentialed fetch
 * or two apps that look like two products.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // The trailing dot is part of the wordmark, not punctuation.
    name: "LOR.",
    short_name: "LOR.",
    description: "مكالمات فيديو مفتوحة المصدر بتفتكر. من غير حساب، من غير وقت محدود، من غير تحميل.",

    // "/" negotiates the locale rather than pinning the installed app to one.
    start_url: "/",
    scope: "/",

    // Standalone, not fullscreen: a meeting needs the system clock, the battery
    // and the way back out of it.
    display: "standalone",
    orientation: "any",

    // Matches the call screen rather than the marketing page. An installed app
    // opens on a dark splash and stays dark, which is what the call is.
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",

    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        // Cropped by the launcher into whatever shape it uses, so the mark is
        // drawn smaller inside it.
        src: "/icons/maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
