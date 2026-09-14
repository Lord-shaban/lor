import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  [375, 844],
  [768, 900],
  [1024, 900],
  [1440, 900],
] as const;

const copy = {
  ar: {
    path: "/ar/about",
    direction: "rtl",
    title: "اجتماعات بتفتكر اللي يهم.",
    live: "جرّب الموقع المباشر",
    source: "شوف الكود",
    visual: "اقرأ وصف الصورة",
    alt: "عرض اصطناعي لاجتماع LOR.‎ بيبيّن بلاطتين للمكالمة جنب transcript محفوظ وقرار راجعه المضيف.",
  },
  en: {
    path: "/en/about",
    direction: "ltr",
    title: "Meetings that remember what matters.",
    live: "Try the live app",
    source: "View the source",
    visual: "Read the visual description",
    alt: "A synthetic LOR. meeting view shows two call tiles beside a retained transcript and a host-reviewed decision.",
  },
} as const;

test.describe("public project landing", () => {
  for (const locale of ["ar", "en"] as const) {
    test(`keeps the ${locale} story equivalent, navigable, and responsive`, async ({ page }) => {
      const text = copy[locale];
      await page.emulateMedia({ reducedMotion: "reduce" });

      for (const [width, height] of VIEWPORTS) {
        await page.setViewportSize({ width, height });
        await page.goto(text.path);

        await expect(page.locator("html")).toHaveAttribute("dir", text.direction);
        await expect(page.getByRole("heading", { level: 1, name: text.title })).toBeVisible();
        await expect(page.getByRole("link", { name: text.live, exact: true })).toHaveAttribute(
          "href",
          "https://lor-bay.vercel.app",
        );
        await expect(page.getByRole("link", { name: text.source, exact: true })).toHaveAttribute(
          "href",
          "https://github.com/Lord-shaban/lor",
        );

        const preview = page.getByRole("img", { name: text.alt });
        await expect(preview).toBeVisible();
        await expect(preview).toHaveAttribute("src", /product-preview/);
        await expect(page.getByText(text.visual, { exact: true })).toBeVisible();

        await expect(page.locator("main h2")).toHaveCount(4);
        await expect(page.locator("#story")).toBeVisible();
        await expect(page.locator("#open-source")).toBeVisible();
        await expect(page.locator('a[href="#story"]')).toHaveCount(1);
        await expect(page.locator("a[href='#open-source']")).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);

        const mediaDetails = page.locator("figure details");
        const mediaSummary = mediaDetails.locator("summary");
        await mediaSummary.focus();
        await page.keyboard.press("Enter");
        await expect(mediaDetails).toHaveAttribute("open", "");
        await expect(mediaDetails.getByText(text.alt, { exact: true })).toBeVisible();
      }
    });
  }

  test("keeps the primary actions reachable in keyboard order", async ({ page }) => {
    await page.goto("/en/about");

    const heroLive = page.getByRole("link", { name: "Try the live app", exact: true });
    const heroSource = page.getByRole("link", { name: "View the source", exact: true });
    await heroLive.focus();
    await expect(heroLive).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(heroSource).toBeFocused();
  });
});
